import {test,expect,type Page} from '@playwright/test';
import {createGame,spawn} from '../../src/sim/world';
import {encodeSave} from '../../src/sim/save';
import type {GameState} from '../../src/sim/types';
import {RTSCamera} from '../../src/render/camera3d';
async function load(page:Page,state:GameState){
 await page.goto('/');await page.evaluate(async text=>new Promise<void>((resolve,reject)=>{const r=indexedDB.open('ironvale-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('matches',{keyPath:'slot'});r.onsuccess=()=>{const db=r.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),encodeSave(state));
 await page.reload();await page.getByRole('button',{name:'Load saved match',exact:true}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();
 await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:40000});
}
async function saved(page:Page){await page.getByRole('button',{name:'Save match',exact:true}).click();await expect(page.getByText('Match saved in this browser.',{exact:true})).toBeVisible();return page.evaluate(async()=>new Promise<any>(resolve=>{const r=indexedDB.open('ironvale-saves',1);r.onsuccess=()=>{const db=r.result,g=db.transaction('matches').objectStore('matches').get('manual');g.onsuccess=()=>{db.close();resolve(JSON.parse(g.result.text));};};}));}
test('move and remove an owned building with preserved health and a removal confirmation',async({page},info)=>{
 test.setTimeout(90000);const state=createGame({opponents:1,difficulty:'easy',seed:42,zombies:true});state.players.forEach(p=>p.controller='human');
 for(const e of Object.values(state.entities))if(e.kind==='resource'&&e.x>=21&&e.x<=30&&e.y>=21&&e.y<=29)delete state.entities[e.id];
 const house=spawn(state,'building','house',0,{x:22,y:22});house.hp=350;
 await load(page,state);const viewport=page.viewportSize()!,zoom=viewport.width<600?.92:1.1;
 const camera=new RTSCamera();camera.configure({...viewport,focus:{x:19.5,y:21},zoom,yaw:Math.PI/4,origin:viewport.width<700?.44:.42});const point=(x:number,y:number)=>camera.project({x,y});
 const p=camera.project({x:23,y:23},.5);await page.mouse.click(p.x,p.y);await expect(page.getByRole('button',{name:'Move building',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Move building',exact:true}).click();const destination=point(25.2,24.2);await page.mouse.click(destination.x,destination.y);
 await expect(page.locator('.order-banner')).toHaveCount(0);const moved=await saved(page);expect(moved.entities[house.id]).toMatchObject({x:25,y:24,hp:350});
 await page.getByRole('button',{name:'Remove building',exact:true}).click();await expect(page.getByRole('group',{name:'Confirm building removal'})).toBeVisible();
 await page.getByRole('button',{name:'Confirm removal',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/${info.project.name}-building-controls.png`});
 await page.getByRole('button',{name:'Keep building',exact:true}).click();await expect(page.getByRole('group',{name:'Confirm building removal'})).toHaveCount(0);
 await page.getByRole('button',{name:'Remove building',exact:true}).click();await page.getByRole('button',{name:'Confirm removal',exact:true}).click();await expect(page.locator('.selection-panel')).toContainText('Your orders');
 expect((await saved(page)).entities[house.id]).toBeUndefined();await expect(page.getByTestId('zombie-phase')).toHaveText('Zombies in forest');
});
test('night zombies render and daylight zombies retreat without attacking',async({page},info)=>{
 test.setTimeout(120000);const state=createGame({opponents:1,difficulty:'easy',seed:42,zombies:true});state.players.forEach(p=>p.controller='human');state.tick=19200;state.zombieNight=0;
 for(const e of Object.values(state.entities))if(e.kind==='resource'&&Math.hypot(e.x-24,e.y-24)<3)delete state.entities[e.id];
 const zombie=spawn(state,'unit','zombie',-2,{x:24,y:24});zombie.home={x:40,y:40};
 await load(page,state);await expect(page.getByTestId('zombie-phase')).toHaveText('Night raid');await page.screenshot({path:`test-results/${info.project.name}-zombie-night.png`});
 const night=await saved(page);expect(night.config.zombies).toBe(true);expect(night.entities[zombie.id]?.order.kind).toBe('attack');
 state.tick=26401;const cap=state.entities[state.players[0].capital];const hp=cap.hp;zombie.x=18;zombie.y=17;zombie.order={kind:'attack',target:cap.id};zombie.cooldown=0;
 await load(page,state);await expect(page.getByTestId('zombie-phase')).toHaveText('Zombies in forest');const day=await saved(page);expect(day.entities[cap.id].hp).toBe(hp);expect(day.entities[zombie.id].order.kind).toBe('move');expect(day.entities[zombie.id].order.point).toEqual(zombie.home);
});
test('an online host enables zombie mode and the guest receives the shared setting',async({page,browser},info)=>{
 test.skip(info.project.name!=='desktop');test.setTimeout(90000);const context=await browser.newContext(),friend=await context.newPage();let hostSnapshot:any,guestSnapshot:any;
 for(const [p,isHost]of [[page,true],[friend,false]]as const)p.on('websocket',ws=>ws.on('framereceived',f=>{try{const m=JSON.parse(String(f.payload));if(m.type==='snapshot'){if(isHost)hostSnapshot=m.snapshot;else guestSnapshot=m.snapshot;}}catch{}}));
 try{for(const [p,name]of [[page,'Undead host'],[friend,'Undead guest']]as const){await p.goto('/');await p.getByRole('button',{name:'Play with Freinds',exact:true}).click();await p.getByLabel('Your name').fill(name);}
 await page.getByRole('button',{name:'Create room',exact:true}).click();await page.getByRole('checkbox',{name:'Zombie mode',exact:true}).check();await page.getByRole('button',{name:'Open room',exact:true}).click();const code=await page.getByTestId('room-code').textContent();
 await friend.getByRole('button',{name:'Join room',exact:true}).click();await friend.getByLabel('Room code').fill(code!);await friend.getByRole('button',{name:'Join friends',exact:true}).click();await expect(friend.getByText(/No team is spared/)).toBeVisible();
 await page.getByLabel('Room zombie mode').click();await expect(friend.getByText(/No team is spared/)).toHaveCount(0);await expect(page.getByLabel('Room zombie mode')).not.toBeChecked();await page.getByLabel('Room zombie mode').click();await expect(page.getByLabel('Room zombie mode')).toBeChecked();
 for(const p of [page,friend])await p.getByRole('button',{name:'Ready',exact:true}).click();await page.getByRole('button',{name:'Start match',exact:true}).click();
 await expect.poll(()=>hostSnapshot?.config.zombies&&guestSnapshot?.config.zombies).toBe(true);await expect(friend.getByTestId('zombie-phase')).toHaveText('Zombies in forest');
  await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:40000});
  await page.getByRole('button',{name:'Idle villagers',exact:true}).click();await page.getByRole('button',{name:'Build House',exact:true}).click();
  const viewport=page.viewportSize()!,camera=new RTSCamera();camera.configure({...viewport,focus:{x:17,y:22},zoom:1.1,yaw:Math.PI/4,origin:.42});const build=camera.project({x:22.2,y:22.2});await page.mouse.click(build.x,build.y);
  const house=()=>hostSnapshot?.entities.find((e:any)=>e.type==='house'&&e.owner===0);await expect.poll(()=>house()?.progress,{timeout:20000}).toBe(1);const id=house().id;
  const selectHouse=camera.project({x:23,y:23},.5);await page.mouse.click(selectHouse.x,selectHouse.y);await page.getByRole('button',{name:'Move building',exact:true}).click();const destination=camera.project({x:21.2,y:25.2});await page.mouse.click(destination.x,destination.y);
  await expect.poll(()=>house()?.x).toBe(21);await expect.poll(()=>house()?.y).toBe(25);expect(house().id).toBe(id);
  await page.getByRole('button',{name:'Remove building',exact:true}).click();await page.getByRole('button',{name:'Confirm removal',exact:true}).click();await expect.poll(()=>house()).toBeUndefined();expect(guestSnapshot.players[1].resources.wood).toBe(450);
 }finally{await context.close();}
});
