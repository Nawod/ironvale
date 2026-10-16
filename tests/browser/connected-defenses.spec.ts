import {expect,test,type Page} from '@playwright/test';
import {createGame,spawn} from '../../src/sim/world';
import {encodeSave} from '../../src/sim/save';
import {updateVisibility} from '../../src/sim/visibility';
import {RTSCamera} from '../../src/render/camera3d';
import {openCommands} from './hud-helpers';

async function fixture(page:Page,blocked=false,delayReplies=false){
 await page.addInitScript(delay=>{const root=window as any,Native=Worker;root.__wallReplies=[];root.Worker=class extends Native{
  constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.addEventListener('message',event=>{if(event.data.type==='snapshot')root.__defenseSnapshot=event.data.snapshot;});}
  override set onmessage(handler:((this:Worker,event:MessageEvent)=>any)|null){super.onmessage=handler?event=>{if(delay&&event.data.type==='commandResult')root.__wallReplies.push(()=>handler.call(this,event));else handler.call(this,event);}:null;}
  override get onmessage(){return super.onmessage;}
 };},delayReplies);
 const s=createGame({opponents:1,difficulty:'easy',seed:42,mapType:'lowlands'});s.players.forEach(p=>p.controller='human');s.players[0].age=2;s.players[0].resources={food:1000,wood:1000,stone:1000,gold:1000};
 for(const e of Object.values(s.entities))if(e.kind==='unit'&&e.owner===0||e.kind==='resource'&&e.x>11&&e.x<36&&e.y>11&&e.y<36)delete s.entities[e.id];
 spawn(s,'unit','villager',0,{x:23.5,y:24.5});spawn(s,'building','palisade',0,{x:21,y:21});if(blocked)spawn(s,'resource','stone',-1,{x:23.4,y:21.4});updateVisibility(s);
 await page.goto('/');await page.evaluate(text=>new Promise<void>(resolve=>{const r=indexedDB.open('ironvale-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('matches',{keyPath:'slot'});r.onsuccess=()=>{const db=r.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};};}),encodeSave(s));
 await page.reload();await page.getByRole('button',{name:'Load saved match',exact:true}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:40000});
 await page.getByRole('button',{name:'Idle villagers',exact:true}).click();
 const map=page.locator('.minimap canvas');if(!await map.isVisible())await page.getByRole('button',{name:'Show minimap',exact:true}).click();const r=(await map.boundingBox())!;await page.mouse.click(r.x+24/s.size*r.width,r.y+24/s.size*r.height);if(await page.getByRole('button',{name:'Close minimap',exact:true}).isVisible())await page.getByRole('button',{name:'Close minimap',exact:true}).click();
 await openCommands(page,'Build');
 const camera=new RTSCamera(),viewport=page.viewportSize()!;camera.configure({...viewport,focus:{x:24,y:24},zoom:viewport.width<600?.92:1.1,yaw:Math.PI/4,origin:viewport.width<700?.44:.42});
 return async(x:number,y:number)=>{const p=camera.project({x:x+.5,y:y+.5});if(test.info().project.name==='phone')await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);};
}

test('wall lines preview an L corner and charge only new sections after confirmation',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const tap=await fixture(page);
 await page.getByRole('button',{name:'Build Wooden wall line',exact:true}).click();await expect(page.getByRole('region',{name:'Wall line planner',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Build line',exact:true})).toBeDisabled();await tap(21,21);await tap(25,23);
 const tray=page.getByRole('region',{name:'Wall line planner',exact:true});await expect(tray).toContainText('7 sections');await expect(tray).toContainText('48 wood');await expect(page.locator('.resource.wood > span')).toHaveText('1000');
 expect(await page.evaluate(()=>(window as any).__defenseSnapshot.entities.filter((e:any)=>e.type==='palisade').length)).toBe(1);
 const button=page.getByRole('button',{name:'Build line',exact:true});const box=(await button.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);await page.screenshot({path:`test-results/${info.project.name}-wall-line-preview.png`});await button.click();
 await expect(page.locator('.resource.wood > span')).toHaveText('952');await expect.poll(()=>page.evaluate(()=>(window as any).__defenseSnapshot.entities.filter((e:any)=>e.type==='palisade').length)).toBe(7);
 await expect(tray).toContainText('Choose a start');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(tray).toHaveCount(0);await page.screenshot({path:`test-results/${info.project.name}-connected-defenses.png`});expect(errors).toEqual([]);
});

test('an earlier wall acknowledgment cannot erase a new plan after cancellation',async({page},info)=>{
 test.skip(info.project.name!=='desktop');const tap=await fixture(page,false,true);
 await page.getByRole('button',{name:'Build Wooden wall line',exact:true}).click();await tap(21,21);await tap(25,23);await page.getByRole('button',{name:'Build line',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__wallReplies.length)).toBe(1);await expect(page.getByRole('button',{name:'Building…',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await openCommands(page,'Build');await page.getByRole('button',{name:'Build Wooden wall line',exact:true}).click();await tap(21,25);await tap(25,25);
 const tray=page.getByRole('region',{name:'Wall line planner',exact:true});await expect(tray).toContainText('5 sections');await expect(tray).toContainText('40 wood');
 await page.evaluate(()=>{for(const reply of (window as any).__wallReplies.splice(0))reply();});await expect(tray).toContainText('5 sections');await expect(page.getByRole('button',{name:'Build line',exact:true})).toBeEnabled();
});

test('wall-line planning blocks occupied routes and remains usable in landscape',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});if(info.project.name==='phone')await page.setViewportSize({width:844,height:390});const tap=await fixture(page,true);
 await page.getByRole('button',{name:'Build Wooden wall line',exact:true}).click();await tap(21,21);await tap(25,23);

 const tray=page.getByRole('region',{name:'Wall line planner',exact:true});await expect(tray).toContainText('clear land');await expect(page.getByRole('button',{name:'Build line',exact:true})).toBeDisabled();await expect(page.locator('.resource.wood > span')).toHaveText('1000');
 await page.getByRole('button',{name:'Start over',exact:true}).click();await expect(tray).toContainText('Choose a start');await tap(21,23);await tap(25,23);await expect(page.getByRole('button',{name:'Build line',exact:true})).toBeEnabled();
 const r=(await tray.boundingBox())!,viewport=page.viewportSize()!;expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(viewport.width);expect(r.y+r.height).toBeLessThanOrEqual(viewport.height);
 const build=page.getByRole('button',{name:'Build line',exact:true});expect(await build.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await expect(page.locator('.toast')).toHaveCount(0,{timeout:6000});await page.screenshot({path:`test-results/${info.project.name}-wall-line-landscape.png`});await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(tray).toHaveCount(0);await openCommands(page,'Build');await page.getByRole('button',{name:'Build Wooden wall line',exact:true}).click();await expect(tray).toContainText('Choose a start');expect(errors).toEqual([]);
});
