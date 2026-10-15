import {test,expect} from '@playwright/test';
import {createGame,spawn} from '../../src/sim/world';
import {updateVisibility} from '../../src/sim/visibility';
import {encodeSave} from '../../src/sim/save';
import {writeFileSync} from 'node:fs';
test('starts a match, recruits villagers, saves and resumes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.screenshot({path:`test-results/${test.info().project.name}-menu.png`});await page.getByRole('button',{name:'Begin your reign'}).click();
 await expect(page.getByTestId('battlefield')).toBeVisible();await expect(page.getByTestId('population')).toContainText('7 / 15');
 await page.getByRole('button',{name:'Town center',exact:true}).click();await page.getByRole('button',{name:'Recruit Villager',exact:true}).click();
 await expect(page.getByText('Training Villager')).toBeVisible();
 await page.getByRole('button',{name:'Save match',exact:true}).click();await expect(page.getByRole('status')).toContainText('Match saved');
 await page.getByRole('button',{name:'Pause match',exact:true}).click();await expect(page.getByRole('heading',{name:'The realm can wait'})).toBeVisible();await page.getByRole('button',{name:'Resume match',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Load saved match'}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();await expect(page.locator('.resource.food > span')).toHaveText('300');
 await page.screenshot({path:`test-results/${test.info().project.name}-battlefield.png`});expect(errors).toEqual([]);
});
test('four empires and tutorial remain usable at the device viewport',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Three rivals'}).click();await page.getByRole('button',{name:'Learn as you play'}).click();await page.getByRole('button',{name:'Begin your reign'}).click();await expect(page.getByTestId('empire-count')).toContainText('4');await expect(page.getByText('A home for your people',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Idle villagers'})).toBeVisible();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);expect(overflow).toBe(false);});
test('assigns gathering and places a house through the battlefield',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Begin your reign'}).click();await expect(page.locator('[data-testid="battlefield"] canvas')).toBeVisible();await page.getByRole('button',{name:'Idle villagers'}).click();await page.getByRole('button',{name:'Gather',exact:true}).click();
 const viewport=page.viewportSize()!,zoom=viewport.width<600?.92:1.1;
 const point=(x:number,y:number)=>({x:viewport.width/2+((x-y)*32+160)*zoom,y:viewport.height*(viewport.width<700?.44:.42)+((x+y)*16-624)*zoom});
 const tap=async(p:{x:number;y:number})=>{if(info.project.name==='desktop')await page.mouse.click(p.x,p.y);else await page.touchscreen.tap(p.x,p.y);};
 const tree=point(20,28);tree.y-=30*zoom;await tap(tree);await expect(page.locator('.order-banner')).toHaveCount(0);
 await expect.poll(async()=>Number(await page.locator('.resource.wood > span').textContent()),{timeout:25000}).toBeGreaterThan(450);
 await page.getByRole('button',{name:'Build House',exact:true}).click();await tap(point(22.2,22.2));await expect(page.getByTestId('population')).toContainText('/ 25',{timeout:15000});
 await page.screenshot({path:`test-results/${info.project.name}-construction.png`});
});
test('phone landscape has usable setup and command panels',async({page},info)=>{test.skip(info.project.name!=='phone');await page.setViewportSize({width:844,height:390});await page.goto('/');await page.getByRole('button',{name:'Begin your reign'}).click();await page.getByRole('button',{name:'Idle villagers'}).click();await expect(page.getByRole('button',{name:'Build House',exact:true})).toBeVisible();await page.screenshot({path:'test-results/phone-landscape.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);});
for(const empireCount of [4,8])test(`${empireCount*100}-unit rendering stress measurement`,async({page},info)=>{
 test.skip(info.project.name==='tablet');test.setTimeout(90000);const state=createGame({opponents:(empireCount-1) as any,difficulty:'hard',seed:42}),cap=state.entities[state.players[0].capital];
 for(const e of Object.values(state.entities))if(e.kind==='unit')delete state.entities[e.id];
 for(const p of state.players){p.ai.nextThink=1e9;for(let j=0;j<100;j++){const e=spawn(state,'unit',j%4===0?'archer':'spearman',p.id,{x:cap.x-12+(j%10)*1.2+(p.id%4)*8,y:cap.y-12+Math.floor(j/10)*1.2+Math.floor(p.id/4)*8});e.stance='hold';e.hp=e.maxHp=1e9;}}
 updateVisibility(state);state.visible.forEach(a=>a.fill(1));state.explored.forEach(a=>a.fill(1));
 await page.goto('/');await page.evaluate(async text=>{await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('ironvale-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('matches',{keyPath:'slot'});r.onsuccess=()=>{const db=r.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},encodeSave(state));
 await page.reload();await page.getByRole('button',{name:'Load saved match'}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();await expect(page.getByTestId('population')).toContainText('100 / 15');await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:30000});
 await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-scenery-detail','ready');
 if(info.project.name==='phone'){const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 if(process.env.IRONVALE_PROFILE){const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await page.waitForTimeout(4000);const result=await cdp.send('Profiler.stop');writeFileSync('test-results/cpu-profile.json',JSON.stringify(result.profile));console.log(result.profile.nodes.filter((n:any)=>n.hitCount).sort((a:any,b:any)=>b.hitCount-a.hitCount).slice(0,15).map((n:any)=>({name:n.callFrame.functionName,url:n.callFrame.url,hits:n.hitCount})));}
 const timing=await page.evaluate(()=>new Promise<{fps:number;p95:number;frames:number}>(resolve=>{const frames:number[]=[];let last=performance.now();const sample=(t:number)=>{frames.push(t-last);last=t;if(frames.length<150)requestAnimationFrame(sample);else{const clean=frames.slice(30),sorted=[...clean].sort((a,b)=>a-b);resolve({fps:1000/(clean.reduce((a,b)=>a+b,0)/clean.length),p95:sorted[Math.floor(sorted.length*.95)],frames:clean.length});}};requestAnimationFrame(sample);}));
 const gpu=await page.evaluate(()=>{const canvas=document.querySelector('[data-testid="battlefield"] canvas') as HTMLCanvasElement;const gl=canvas.getContext('webgl2')??canvas.getContext('webgl');if(!gl)return 'Unknown';const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 const renderScale=await page.locator('[data-testid="battlefield"] canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).width/canvas.clientWidth);
 const report={device:info.project.name,viewport:page.viewportSize(),units:empireCount*100,cpuThrottle:info.project.name==='phone'?4:1,rendering:gpu,renderScale,...timing};writeFileSync(`test-results/${info.project.name}-${empireCount*100}-performance.json`,JSON.stringify(report,null,2));await info.attach('performance.json',{body:JSON.stringify(report),contentType:'application/json'});console.log(`STRESS ${info.project.name}: ${JSON.stringify({...timing,renderScale,gpu})}`);expect(timing.fps).toBeGreaterThan(info.project.name==='desktop'?55:30);
});
