import {expect,test,type Page} from '@playwright/test';
import {createGame,spawn} from '../../src/sim/world';
import {encodeSave} from '../../src/sim/save';
import {updateVisibility} from '../../src/sim/visibility';
import {RTSCamera} from '../../src/render/camera3d';
import {openCommands,openGameMenu} from './hud-helpers';
import type {GameState,Position} from '../../src/sim/types';

async function observe(page:Page){await page.addInitScript(()=>{const root=window as any,Native=Worker;root.Worker=class extends Native{constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.addEventListener('message',event=>{if(event.data.type==='snapshot')root.__riverSnapshot=event.data.snapshot;});}};});}
async function load(page:Page,s:GameState){
 await page.goto('/');await page.evaluate(text=>new Promise<void>(resolve=>{const request=indexedDB.open('ironvale-saves',1);request.onupgradeneeded=()=>request.result.createObjectStore('matches',{keyPath:'slot'});request.onsuccess=()=>{const db=request.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};};}),encodeSave(s));
 await page.reload();await page.getByRole('button',{name:'Load saved match',exact:true}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:40000});
}
async function centerMap(page:Page,point:Position,size:number){
 const map=page.locator('.minimap canvas');if(!await map.isVisible())await page.getByRole('button',{name:'Show minimap',exact:true}).click();const rect=(await map.boundingBox())!;await page.mouse.click(rect.x+point.x/size*rect.width,rect.y+point.y/size*rect.height);
}
test('map choice is readable and retained when returning from a paused match',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await observe(page);await page.goto('/');const choice=page.getByLabel('Map type',{exact:true});await expect(choice).toHaveValue('riverlands');await choice.scrollIntoViewIfNeeded();expect(await choice.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);await choice.selectOption('lowlands');
 await page.getByRole('button',{name:'Begin your reign',exact:true}).click();await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-map-type','lowlands');await expect.poll(()=>page.evaluate(()=>(window as any).__riverSnapshot?.terrain.every((v:number)=>v<3))).toBe(true);
 const menu=await openGameMenu(page);await menu.getByRole('button',{name:'Main menu',exact:true}).click();await choice.selectOption('riverlands');await page.waitForTimeout(600);await expect(choice).toHaveValue('riverlands');await page.getByRole('button',{name:'Begin your reign',exact:true}).click();await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-map-type','riverlands');
 await expect.poll(()=>page.evaluate(()=>(window as any).__riverSnapshot?.terrain.includes(3))).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:`test-results/${info.project.name}-riverlands-start.png`});
});

test('a real army crosses the bridge and construction rejects deep water',async({page},info)=>{
 test.setTimeout(90000);if(info.project.name==='phone')await page.setViewportSize({width:844,height:390});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await observe(page);
 const s=createGame({opponents:1,difficulty:'easy',seed:42,mapType:'riverlands'});s.players.forEach(p=>p.controller='human');s.players[0].age=3;s.players[0].resources={food:10000,wood:10000,stone:10000,gold:10000};
 const y=Math.round(s.size*.33),xs=s.terrain.slice(y*s.size,(y+1)*s.size).flatMap((t,x)=>t===5?[x]:[]),left=Math.min(...xs),right=Math.max(...xs),focus={x:(left+right+1)/2,y:y+.5};
 for(const e of Object.values(s.entities))if(e.kind==='unit'&&e.owner===0||e.kind==='resource'&&Math.hypot(e.x-focus.x,e.y-focus.y)<18)delete s.entities[e.id];
 const cap=s.entities[s.players[0].capital];cap.x=left-13;cap.y=y-9;
 spawn(s,'building','barracks',0,{x:left-10,y:y-3});spawn(s,'building','range',0,{x:left-9,y:y+3});spawn(s,'building','house',0,{x:left-7,y:y-7});
 const worker=spawn(s,'unit','villager',0,{x:left-1.5,y:y+4.5}),army=Array.from({length:6},(_,i)=>spawn(s,'unit',i<3?'spearman':i<5?'archer':'cavalry',0,{x:left-3.5-(i%2)*.6,y:y-.4+Math.floor(i/2)*.5}));
 s.explored[0].fill(1);updateVisibility(s);await load(page,s);await page.getByRole('button',{name:'Idle villagers',exact:true}).click();await centerMap(page,focus,s.size);await openCommands(page,'Build');await page.getByRole('button',{name:'Build House',exact:true}).click();
 const viewport=page.viewportSize()!,camera=new RTSCamera();camera.configure({...viewport,focus,zoom:viewport.width<600?.92:1.1,yaw:Math.PI/4,origin:viewport.width<700?.44:.42});
 const row=y+4,water=s.terrain.slice(row*s.size,(row+1)*s.size).findIndex(t=>t===3),site={x:water+.2,y:row+.2};await expect.poll(()=>page.evaluate(point=>{const s=(window as any).__riverSnapshot;return s?.fog[Math.floor(point.y)*s.size+Math.floor(point.x)];},site)).toBe(2);
 const screen=camera.project(site);await page.mouse.click(screen.x,screen.y);await expect(page.locator('.toast')).toBeVisible();await expect.poll(()=>page.evaluate(id=>(window as any).__riverSnapshot?.entities.filter((e:any)=>e.owner===0&&e.kind==='building').length,worker.id)).toBe(4);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Select all army',exact:true}).click();await openCommands(page,'Orders');await page.getByLabel('Army formation',{exact:true}).selectOption('line');await page.getByRole('button',{name:'Move',exact:true}).click();const destination=camera.project({x:right+3.5,y:y+.5});await page.mouse.click(destination.x,destination.y);
 await expect.poll(()=>page.evaluate(ids=>{const s=(window as any).__riverSnapshot;return s?.entities.filter((e:any)=>ids.includes(e.id)).every((e:any)=>e.x>s.terrain.slice(Math.round(s.size*.33)*s.size,(Math.round(s.size*.33)+1)*s.size).lastIndexOf(5));},army.map(e=>e.id)),{timeout:25000}).toBe(true);
 if(info.project.name==='desktop'&&await page.getByRole('button',{name:'Collapse commands',exact:true}).isVisible())await page.getByRole('button',{name:'Collapse commands',exact:true}).click();await page.screenshot({path:`test-results/${info.project.name}-riverlands-crossing.png`});expect(errors).toEqual([]);
});

test('private multiplayer retains the selected map through settings changes and reconnect',async({page,browser},info)=>{
 test.skip(info.project.name!=='desktop');test.setTimeout(90000);const context=await browser.newContext(),friend=await context.newPage();let latest:any;page.on('websocket',socket=>socket.on('framereceived',frame=>{try{const m=JSON.parse(String(frame.payload));if(m.type==='snapshot')latest={...m.snapshot,terrain:m.snapshot.terrain??latest?.terrain};}catch{}}));
 try{
  for(const [p,name]of [[page,'River host'],[friend,'River guest']]as const){await p.goto('/');await p.getByRole('button',{name:'Play with Freinds',exact:true}).click();await p.getByLabel('Your name').fill(name);}
  await page.getByRole('button',{name:'Create room',exact:true}).click();await expect(page.getByLabel('Online map type',{exact:true})).toHaveValue('riverlands');await page.getByRole('button',{name:'Open room',exact:true}).click();await page.getByLabel('Room map type',{exact:true}).selectOption('lowlands');await page.getByLabel('Room map type',{exact:true}).selectOption('riverlands');await page.getByLabel('Room zombie mode',{exact:true}).check();await expect(page.getByLabel('Room map type',{exact:true})).toHaveValue('riverlands');
  const code=(await page.getByTestId('room-code').textContent())!;await friend.getByRole('button',{name:'Join room',exact:true}).click();await friend.getByLabel('Room code').fill(code);await friend.getByRole('button',{name:'Join friends',exact:true}).click();await expect(friend.locator('#room-map-description')).toContainText('Riverlands');for(const p of [page,friend])await p.getByRole('button',{name:'Ready',exact:true}).click();await page.getByRole('button',{name:'Start match',exact:true}).click();
  await expect.poll(()=>latest?.config.mapType).toBe('riverlands');expect(latest.terrain.includes(3)).toBe(true);expect(latest.config.zombies).toBe(true);await page.reload();await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-map-type','riverlands');expect(latest.config.mapType).toBe('riverlands');
 }finally{await context.close();}
});

test('the menu backdrop stops GPU drawing behind the lobby and resumes when closed',async({page})=>{
 await page.addInitScript(()=>{
  const root=window as any,proto=WebGL2RenderingContext.prototype as any;root.__menuDraws=0;
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=proto[name];proto[name]=function(...args:any[]){root.__menuDraws++;return original.apply(this,args);};}
 });
 await page.goto('/');await expect.poll(()=>page.evaluate(()=>(window as any).__menuDraws)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Play with Freinds',exact:true}).click();await expect(page.getByLabel('Online multiplayer',{exact:true})).toBeVisible();
 const frames=()=>page.evaluate(()=>new Promise<void>(resolve=>{let n=0;const next=()=>++n===8?resolve():requestAnimationFrame(next);requestAnimationFrame(next);}));
 await frames();const paused=await page.evaluate(()=>(window as any).__menuDraws);await frames();expect(await page.evaluate(()=>(window as any).__menuDraws)).toBe(paused);
 await page.getByRole('button',{name:'Close online lobby',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__menuDraws)).toBeGreaterThan(paused);
});
