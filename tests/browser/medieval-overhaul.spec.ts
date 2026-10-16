import {expect,test,type Page} from '@playwright/test';
import {createGame,spawn} from '../../src/sim/world';
import {encodeSave} from '../../src/sim/save';
import type {GameState} from '../../src/sim/types';
import {RTSCamera} from '../../src/render/camera3d';
import {openCommands} from './hud-helpers';

async function observe(page:Page){await page.addInitScript(()=>{
 const root=window as any,Native=Worker;root.Worker=class extends Native{constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.addEventListener('message',event=>{if(event.data.type==='snapshot')root.__medievalSnapshot=event.data.snapshot;});}};
});}
async function load(page:Page,state:GameState){
 await page.goto('/');await page.evaluate(async text=>new Promise<void>(resolve=>{const r=indexedDB.open('ironvale-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('matches',{keyPath:'slot'});r.onsuccess=()=>{const db=r.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};};}),encodeSave(state));await page.reload();await page.getByRole('button',{name:'Load saved match',exact:true}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();
 await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:40000});
}
function fixture(){const s=createGame({opponents:1,difficulty:'easy',seed:42});s.players.forEach(p=>p.controller='human');s.players[0].resources={food:10000,wood:10000,stone:10000,gold:10000};return s;}

test('a production rally sends the next paid villager to work and can be cleared',async({page},info)=>{
 test.setTimeout(90000);if(info.project.name==='phone')await page.setViewportSize({width:844,height:390});await observe(page);
 const s=fixture(),tree=spawn(s,'resource','wood',-1,{x:14,y:18}),capital=s.players[0].capital;await load(page,s);await page.getByRole('button',{name:'Town center',exact:true}).click();await openCommands(page,'Train');
 const rally=page.getByRole('button',{name:'Set rally point',exact:true});await expect(rally).toBeVisible();await rally.click();await expect(page.locator('.order-banner')).toContainText('rally point');if(info.project.name!=='desktop')await expect(page.locator('.actions-panel')).toBeHidden();
 const viewport=page.viewportSize()!,camera=new RTSCamera();camera.configure({...viewport,focus:{x:18,y:18},zoom:viewport.width<600?.92:1.1,yaw:Math.PI/4,origin:viewport.width<700?.44:.42});const point=camera.project(tree,.8);await page.mouse.click(point.x,point.y);
 await expect.poll(()=>page.evaluate(id=>(window as any).__medievalSnapshot?.entities.find((e:any)=>e.id===id)?.rally?.target,capital)).toBe(tree.id);
 await openCommands(page,'Train');await page.getByRole('button',{name:'Recruit Villager',exact:true}).click();await expect(page.getByText('Training Villager',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(id=>(window as any).__medievalSnapshot?.entities.some((e:any)=>e.type==='villager'&&e.id>id&&e.order.kind==='gather'),tree.id),{timeout:20000}).toBe(true);
 await page.screenshot({path:`test-results/${info.project.name}-medieval-rally.png`});await page.getByRole('button',{name:'Clear rally point',exact:true}).click();await expect.poll(()=>page.evaluate(id=>(window as any).__medievalSnapshot?.entities.find((e:any)=>e.id===id)?.rally,capital)).toBeUndefined();
});

test('medieval cities render with working group formations and mobile access',async({page},info)=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});await observe(page);
 const s=fixture();s.players[0].age=3;for(const e of Object.values(s.entities))if(e.kind==='resource'&&e.x>8&&e.x<38&&e.y>10&&e.y<38)delete s.entities[e.id];
 for(const [type,x,y] of [['house',14,18],['house',17,24],['storage',22,21],['market',24,16],['smithy',24,23],['farm',12,23],['barracks',19,27],['stable',24,28],['fortress',28,21],['range',13,28]] as const)spawn(s,'building',type,0,{x,y});
 for(let j=0;j<8;j++)spawn(s,'unit',j<4?'spearman':'archer',0,{x:22+j*.4,y:25});
 for(let i=12;i<34;i++)spawn(s,'building','wall',0,{x:i,y:12});await load(page,s);await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-realm-style','medieval');
 await page.getByRole('button',{name:'Select all army',exact:true}).click();await openCommands(page,'Orders');const select=page.getByLabel('Army formation',{exact:true});await select.scrollIntoViewIfNeeded();expect(await select.evaluate(element=>{const r=element.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.height>=44&&r.width>=44&&!!hit&&(element===hit||element.contains(hit));})).toBe(true);await select.selectOption('spread');
 await expect.poll(()=>page.evaluate(()=>(window as any).__medievalSnapshot?.entities.filter((e:any)=>e.owner===0&&e.kind==='unit'&&e.type!=='villager').every((e:any)=>e.formation==='spread'))).toBe(true);
 await page.getByRole('button',{name:'Move',exact:true}).click();const viewport=page.viewportSize()!,camera=new RTSCamera();camera.configure({...viewport,focus:{x:19.5,y:21},zoom:viewport.width<600?.92:1.1,yaw:Math.PI/4,origin:viewport.width<700?.44:.42});const destination=camera.project({x:23,y:25});await page.mouse.click(destination.x,destination.y);
 await expect.poll(()=>page.evaluate(()=>new Set((window as any).__medievalSnapshot?.entities.filter((e:any)=>e.owner===0&&e.kind==='unit'&&e.type!=='villager'&&e.order.point).map((e:any)=>`${e.order.point.x},${e.order.point.y}`)).size)).toBeGreaterThan(4);
 await expect.poll(()=>page.evaluate(()=>(window as any).__medievalSnapshot?.entities.filter((e:any)=>e.owner===0&&e.kind==='unit'&&e.type!=='villager').every((e:any)=>e.order.kind==='idle')),{timeout:20000}).toBe(true);
 if(info.project.name==='desktop')await page.getByRole('button',{name:'Collapse commands',exact:true}).click();
 if(info.project.name==='phone'){await page.setViewportSize({width:844,height:390});await expect(page.getByRole('button',{name:'Open commands',exact:true})).toBeVisible();}
 await page.screenshot({path:`test-results/${info.project.name}-medieval-city.png`});expect(errors).toEqual([]);
});

test('rally targeting uses the displayed producer after buildings are selected in reverse order',async({page},info)=>{
 test.skip(info.project.name!=='desktop');test.setTimeout(60000);await observe(page);const s=fixture(),producer=spawn(s,'building','barracks',0,{x:24,y:23}),capital=s.players[0].capital;
 await load(page,s);const viewport=page.viewportSize()!,camera=new RTSCamera();camera.configure({...viewport,focus:{x:19.5,y:21},zoom:1.1,yaw:Math.PI/4,origin:.42});
 const newer=camera.project({x:producer.x+1.5,y:producer.y+1.5},.8),older=camera.project({x:19.5,y:19.5},.8);await page.mouse.click(newer.x,newer.y);await page.keyboard.down('Shift');await page.mouse.click(older.x,older.y);await page.keyboard.up('Shift');
 await openCommands(page,'Train');await expect(page.getByRole('button',{name:'Recruit Villager',exact:true})).toBeVisible();await page.getByRole('button',{name:'Set rally point',exact:true}).click();const point=camera.project({x:23,y:27});await page.mouse.click(point.x,point.y);
 await expect.poll(()=>page.evaluate(id=>(window as any).__medievalSnapshot?.entities.find((e:any)=>e.id===id)?.rally?.point,capital)).toBeTruthy();expect(await page.evaluate(id=>(window as any).__medievalSnapshot?.entities.find((e:any)=>e.id===id)?.rally,producer.id)).toBeUndefined();
});

test('online formation and rally commands survive reconnect without sharing resources',async({page,browser},info)=>{
 test.skip(info.project.name!=='desktop');test.setTimeout(120000);let latest:any;page.on('websocket',socket=>socket.on('framereceived',frame=>{try{const message=JSON.parse(String(frame.payload));if(message.type==='snapshot')latest=message.snapshot;}catch{}}));
 const context=await browser.newContext({viewport:{width:1024,height:768}}),friend=await context.newPage();
 try{
  for(const [p,name] of [[page,'Medieval host'],[friend,'Medieval guest']] as const){await p.goto('/');await p.getByRole('button',{name:'Play with Freinds',exact:true}).click();await p.getByLabel('Your name').fill(name);}
  await page.getByRole('button',{name:'Create room',exact:true}).click();await page.getByRole('button',{name:'Open room',exact:true}).click();const code=await page.getByTestId('room-code').textContent();await friend.getByRole('button',{name:'Join room',exact:true}).click();await friend.getByLabel('Room code').fill(code!);await friend.getByRole('button',{name:'Join friends',exact:true}).click();for(const p of [page,friend])await p.getByRole('button',{name:'Ready',exact:true}).click();await page.getByRole('button',{name:'Start match',exact:true}).click();
  await page.getByRole('button',{name:'Select all army',exact:true}).click();await openCommands(page,'Orders');await page.getByLabel('Army formation',{exact:true}).selectOption('box');await expect.poll(()=>latest?.entities.find((e:any)=>e.owner===0&&e.type==='scout')?.formation).toBe('box');
  await page.getByRole('button',{name:'Town center',exact:true}).click();await openCommands(page,'Train');await page.getByRole('button',{name:'Set rally point',exact:true}).click();const camera=new RTSCamera();camera.configure({width:1440,height:900,focus:{x:18,y:18},zoom:1.1,yaw:Math.PI/4,origin:.42});const point=camera.project({x:20,y:24});await page.mouse.click(point.x,point.y);await expect.poll(()=>latest?.entities.find((e:any)=>e.owner===0&&e.type==='capital')?.rally).toBeTruthy();
  await openCommands(page,'Train');await page.getByRole('button',{name:'Recruit Villager',exact:true}).click();await expect(page.locator('.resource.food > span')).toHaveText('300');await expect(friend.locator('.resource.food > span')).toHaveText('350');
  await page.reload();await expect(page.getByTestId('population')).toContainText('/ 15');await page.getByRole('button',{name:'Town center',exact:true}).click();await openCommands(page,'Train');await expect(page.getByRole('button',{name:'Clear rally point',exact:true})).toBeVisible();await page.getByRole('button',{name:'Select all army',exact:true}).click();await openCommands(page,'Orders');await expect(page.getByLabel('Army formation',{exact:true})).toHaveValue('box');
  await page.screenshot({path:'test-results/desktop-medieval-online.png'});
 }finally{await context.close();}
});
