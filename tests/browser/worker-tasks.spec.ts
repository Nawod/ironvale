import {test,expect} from '@playwright/test';
import {createGame} from '../../src/sim/world';
import {encodeSave} from '../../src/sim/save';

test('a worker remembers gathering during construction, saves it, resumes, and can clear it with Stop',async({page},info)=>{
 test.setTimeout(90000);
 const state=createGame({opponents:1,difficulty:'easy',seed:42}),worker=Object.values(state.entities).find(e=>e.type==='villager'&&e.owner===0)!;
 for(const e of Object.values(state.entities))if(e.owner===0&&e.type==='villager'&&e.id!==worker.id)delete state.entities[e.id];
 state.players.forEach(p=>p.controller='human');
 await page.goto('/');await page.evaluate(async text=>new Promise<void>((resolve,reject)=>{
  const request=indexedDB.open('ironvale-saves',1);request.onupgradeneeded=()=>request.result.createObjectStore('matches',{keyPath:'slot'});
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};
 }),encodeSave(state));
 await page.reload();await page.getByRole('button',{name:'Load saved match',exact:true}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();
 await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:30000});
 await page.getByRole('button',{name:'Idle villagers',exact:true}).click();
 const viewport=page.viewportSize()!,zoom=viewport.width<600?.92:1.1;
 const point=(x:number,y:number)=>({x:viewport.width/2+((x-y)*32+160)*zoom,y:viewport.height*(viewport.width<700?.44:.42)+((x+y)*16-624)*zoom});
 const tap=async(p:{x:number;y:number})=>info.project.name==='desktop'?page.mouse.click(p.x,p.y):page.touchscreen.tap(p.x,p.y);
 await page.getByRole('button',{name:'Gather',exact:true}).click();const tree=point(20,28);tree.y-=30*zoom;await tap(tree);await expect(page.locator('.selection-panel')).toContainText('Gathering');
 await page.getByRole('button',{name:'Build House',exact:true}).click();await tap(point(22.2,22.2));
 const pending=page.getByTestId('worker-tasks');await expect(pending.locator('summary')).toHaveText('1 pending task');await pending.locator('summary').click();await expect(pending.locator('li')).toContainText('Gather woodland');
 const colors=await pending.locator('summary').evaluate(element=>({text:getComputedStyle(element).color,background:getComputedStyle(element.closest('.command-deck')!).backgroundColor}));
 const luminance=(color:string)=>{const values=color.match(/[\d.]+/g)!.slice(0,3).map(value=>{const v=Number(value)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
 const light=[luminance(colors.text),luminance(colors.background)].sort((a,b)=>a-b);expect((light[1]+.05)/(light[0]+.05)).toBeGreaterThanOrEqual(4.5);
 await page.screenshot({path:`test-results/${info.project.name}-worker-tasks.png`});await pending.locator('summary').click();
 await page.getByRole('button',{name:'Save match',exact:true}).click();
 await expect(page.getByText('Match saved in this browser.',{exact:true})).toBeVisible();
 const saved=await page.evaluate(async id=>new Promise<any>((resolve,reject)=>{const request=indexedDB.open('ironvale-saves',1);request.onsuccess=()=>{const db=request.result,get=db.transaction('matches').objectStore('matches').get('manual');get.onsuccess=()=>{db.close();resolve(JSON.parse(get.result.text).entities[id].taskQueue);};get.onerror=()=>reject(get.error);};}),worker.id);
 expect(saved[0].order.kind).toBe('gather');
 await expect(page.getByTestId('population')).toContainText('/ 25',{timeout:25000});await expect(page.locator('.selection-panel')).toContainText('Gathering');await expect(pending).toHaveCount(0);
 await page.getByRole('button',{name:'Move',exact:true}).click();await tap(point(20,24));await expect(pending.locator('summary')).toHaveText('1 pending task');
 await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(pending).toHaveCount(0);await expect(page.locator('.selection-panel')).toContainText('Ready');
});

test('online workers retain and resume their own assignments through server snapshots',async({page,browser},info)=>{
 test.skip(info.project.name!=='desktop');test.setTimeout(90000);
 let latest:any;page.on('websocket',socket=>socket.on('framereceived',frame=>{try{const packet=JSON.parse(String(frame.payload));if(packet.type==='snapshot')latest=packet.snapshot;}catch{}}));
 const context=await browser.newContext({viewport:{width:1024,height:768}}),friend=await context.newPage();
 try{
  for(const [p,name]of [[page,'Worker host'],[friend,'Worker guest']]as const){await p.goto('/');await p.getByRole('button',{name:'Play with Freinds',exact:true}).click();await p.getByLabel('Your name').fill(name);}
  await page.getByRole('button',{name:'Create room',exact:true}).click();await page.getByRole('button',{name:'Open room',exact:true}).click();const code=await page.getByTestId('room-code').textContent();
  await friend.getByRole('button',{name:'Join room',exact:true}).click();await friend.getByLabel('Room code').fill(code!);await friend.getByRole('button',{name:'Join friends',exact:true}).click();
  for(const p of [page,friend])await p.getByRole('button',{name:'Ready',exact:true}).click();await page.getByRole('button',{name:'Start match',exact:true}).click();
  await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:30000});
  await page.getByRole('button',{name:'Idle villagers',exact:true}).click();await page.getByRole('button',{name:'Gather',exact:true}).click();
  const point=(x:number,y:number)=>({x:720+((x-y)*32+160)*1.1,y:900*.42+((x+y)*16-624)*1.1}),tree=point(20,28);tree.y-=33;await page.mouse.click(tree.x,tree.y);
  const workers=()=>latest?.entities.filter((e:any)=>e.owner===0&&e.type==='villager')??[];
  await expect.poll(()=>workers().filter((e:any)=>e.order.kind==='gather').length).toBe(6);const targets=new Map(workers().map((e:any)=>[e.id,e.order.target]));
  await page.getByRole('button',{name:'Build House',exact:true}).click();const house=point(22.2,22.2);await page.mouse.click(house.x,house.y);
  await expect.poll(()=>workers().filter((e:any)=>e.taskQueue?.some((t:any)=>t.order.kind==='gather')).length).toBe(6);
  await expect(page.getByTestId('population')).toContainText('/ 25',{timeout:20000});
  await expect.poll(()=>workers().every((e:any)=>e.order.kind==='gather'&&e.order.target===targets.get(e.id)&&!e.taskQueue?.length)).toBe(true);
  await expect(friend.locator('.resource.wood > span')).toHaveText('450');
 }finally{await context.close();}
});
