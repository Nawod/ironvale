import {test,expect} from '@playwright/test';
import {createGame,spawn} from '../../src/sim/world';
import {updateVisibility} from '../../src/sim/visibility';
import {encodeSave} from '../../src/sim/save';
import {RTSCamera} from '../../src/render/camera3d';

test('highlighted friends button and one-click army selection are available',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Play with Freinds',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Begin your reign'}).click();await page.getByRole('button',{name:'Select all army',exact:true}).click();await expect(page.locator('.selection-panel')).toContainText('Scout');
});
test('touch workers gather and move through direct battlefield taps',async({page},info)=>{
 test.skip(info.project.name==='desktop');await recordOrders(page);await page.goto('/');await page.getByRole('button',{name:'Begin your reign'}).click();await page.getByRole('button',{name:'Idle villagers'}).click();
 const v=page.viewportSize()!,camera=new RTSCamera();camera.configure({...v,focus:{x:17,y:22},zoom:v.width<600?.92:1.1,yaw:Math.PI/4,origin:v.width<700?.44:.42});
 const tree=camera.project({x:20,y:28},.8);await page.touchscreen.tap(tree.x,tree.y);
 await expect.poll(async()=>Number(await page.locator('.resource.wood > span').textContent()),{timeout:25000}).toBeGreaterThan(450);
 await expect(page.locator('.selection-panel')).toContainText('6 units');const dest=camera.project({x:21.8,y:21.8});expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName,dest)).toBe('CANVAS');await page.touchscreen.tap(dest.x,dest.y);await expect.poll(()=>page.evaluate(()=>(window as any).__orders.at(-1)?.order.kind)).toBe('move');await expect(page.locator('.selection-panel')).toContainText('6 units');await expect(page.locator('.order-banner')).toHaveCount(0);
});
test('two-finger rotation retains accurate 3D selection',async({page,context},info)=>{
 test.skip(info.project.name==='desktop');await page.goto('/');await page.getByRole('button',{name:'Begin your reign'}).click();const v=page.viewportSize()!,x=v.width/2,y=v.height*.4,cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-40,y},{x:x+40,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-40},{x,y:y+40}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const camera=new RTSCamera();camera.configure({...v,focus:{x:19.5,y:21},zoom:v.width<600?.92:1.1,yaw:3*Math.PI/4,origin:v.width<700?.44:.42});const cap=camera.project({x:19.5,y:19.5},.8);await page.touchscreen.tap(cap.x,cap.y);await expect(page.getByRole('button',{name:'Recruit Villager',exact:true})).toBeVisible();
});

async function recordOrders(page:any){await page.addInitScript(()=>{(window as any).__orders=[];const send=Worker.prototype.postMessage;Worker.prototype.postMessage=function(message:any,...rest:any[]){if(message?.type==='command'&&message.command?.type==='order')(window as any).__orders.push(message.command);return (send as any).call(this,message,...rest);};});}
test('selected villagers finish a half-built house by clicking or tapping it',async({page},info)=>{
 await recordOrders(page);const s=createGame({opponents:1,difficulty:'easy',seed:42});s.players[1].controller='human';const house=spawn(s,'building','house',0,{x:22,y:22});house.progress=.35;house.hp=house.maxHp*.35;updateVisibility(s);
 await page.goto('/');await page.evaluate(async text=>{await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('ironvale-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('matches',{keyPath:'slot'});r.onsuccess=()=>{const db=r.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},encodeSave(s));
 await page.reload();await page.getByRole('button',{name:'Load saved match'}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();await page.getByRole('button',{name:'Idle villagers'}).click();
 const v=page.viewportSize()!,camera=new RTSCamera();camera.configure({...v,focus:{x:17,y:22},zoom:v.width<600?.92:1.1,yaw:Math.PI/4,origin:v.width<700?.44:.42});const point=camera.project({x:23,y:23},.85);
 if(info.project.name==='desktop')await page.mouse.click(point.x,point.y);else await page.touchscreen.tap(point.x,point.y);
 await expect.poll(()=>page.evaluate(()=>(window as any).__orders.at(-1)?.order)).toMatchObject({kind:'build',target:house.id});await expect(page.getByTestId('population')).toContainText('/ 25',{timeout:15000});
});
test('touch soldiers attack an enemy directly without a command button',async({page},info)=>{
 test.skip(info.project.name==='desktop');await recordOrders(page);const s=createGame({opponents:1,difficulty:'easy',seed:42});s.players[1].controller='human';const target=spawn(s,'unit','villager',1,{x:24,y:24});target.hp=target.maxHp=10000;updateVisibility(s);
 await page.goto('/');await page.evaluate(async text=>{await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('ironvale-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('matches',{keyPath:'slot'});r.onsuccess=()=>{const db=r.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},encodeSave(s));
 await page.reload();await page.getByRole('button',{name:'Load saved match'}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();await page.getByRole('button',{name:'Select all army',exact:true}).click();
 const v=page.viewportSize()!,camera=new RTSCamera();camera.configure({...v,focus:{x:19.5,y:21},zoom:v.width<600?.92:1.1,yaw:Math.PI/4,origin:v.width<700?.44:.42});const point=camera.project(target,1.2);await page.touchscreen.tap(point.x,point.y);await expect.poll(()=>page.evaluate(()=>(window as any).__orders.at(-1)?.order)).toMatchObject({kind:'attack',target:target.id});
});
