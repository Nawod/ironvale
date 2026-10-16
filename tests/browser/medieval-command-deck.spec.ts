import {expect,test,type Page} from '@playwright/test';
import {createGame,spawn} from '../../src/sim/world';
import {encodeSave} from '../../src/sim/save';
import {updateVisibility} from '../../src/sim/visibility';
import {openCommands} from './hud-helpers';

async function match(page:Page){
 await page.addInitScript(()=>{
  const root=window as any,Native=Worker,context=HTMLCanvasElement.prototype.getContext,interval=window.setInterval.bind(window),clear=window.clearInterval.bind(window);root.__hudContexts=0;root.__mapTimers=new Set<number>();
  window.setInterval=((handler:TimerHandler,delay?:number,...args:any[])=>{const id=interval(handler,delay,...args);if(delay===100)root.__mapTimers.add(id);return id;}) as any;
  window.clearInterval=((id?:number)=>{root.__mapTimers.delete(id);clear(id);}) as typeof window.clearInterval;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){if(type==='webgl'||type==='webgl2')root.__hudContexts++;return(context as any).call(this,type,...args);} as any;
  root.Worker=class extends Native{constructor(url:string|URL,options?:WorkerOptions){super(url,options);root.__hudWorker=this;this.addEventListener('message',event=>{if(event.data.type==='snapshot')root.__hudSnapshot=event.data.snapshot;});}};
 });
 const state=createGame({opponents:1,difficulty:'easy',seed:42,mapType:'lowlands'});state.players.forEach(p=>p.controller='human');state.players[0].age=2;state.players[0].resources={food:1000,wood:1000,stone:1000,gold:1000};
 for(const e of Object.values(state.entities))if(e.kind==='unit'&&e.owner===0||e.kind==='resource'&&e.x>11&&e.x<32&&e.y>11&&e.y<32)delete state.entities[e.id];
 spawn(state,'unit','villager',0,{x:20,y:23});for(let i=0;i<5;i++){const e=spawn(state,'unit',i<2?'spearman':i<4?'archer':'cavalry',0,{x:20+i*.8,y:24});if(i===2)e.hp=45;}
 updateVisibility(state);await page.goto('/');await page.evaluate(text=>new Promise<void>(resolve=>{const r=indexedDB.open('ironvale-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('matches',{keyPath:'slot'});r.onsuccess=()=>{const db=r.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};};}),encodeSave(state));
 await page.reload();await page.getByRole('button',{name:'Load saved match',exact:true}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:40000});return state;
}

test('model portraits and army composition remain usable without extra 3D contexts',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await match(page);const contexts=await page.evaluate(()=>(window as any).__hudContexts);
 await page.getByRole('button',{name:'Select all army',exact:true}).click();if(info.project.name!=='desktop')await openCommands(page,'Orders');
 const archers=page.getByRole('button',{name:'Select Archer group (2)',exact:true});await expect(archers).toBeVisible();const box=(await archers.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);await archers.click();await expect(page.locator('.selection-panel h2')).toHaveText('2 units');
 const portrait=page.locator('.selection-panel>.entity-portrait');await expect(portrait).toHaveAttribute('src',/archer-0\.webp$/);await expect.poll(()=>portrait.evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBe(192);
 if(info.project.name==='desktop')await expect(page.getByRole('meter',{name:'Selection health',exact:true})).toHaveAttribute('value','120');
 expect(await page.evaluate(()=>(window as any).__hudContexts)).toBe(contexts);await expect(page.locator('.toast')).toHaveCount(0,{timeout:6000});await page.screenshot({path:`test-results/${info.project.name}-medieval-army-deck.png`});expect(errors).toEqual([]);
});

test('an empty selection keeps the command deck compact',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Begin your reign',exact:true}).click();await expect(page.locator('main')).toHaveAttribute('data-has-selection','false');
 expect(await page.locator('.command-deck').evaluate(e=>e.getBoundingClientRect().height)).toBeLessThanOrEqual(64);
});

test('the graphical production deck keeps training progress and all commands readable',async({page},info)=>{
 if(info.project.name==='phone')await page.setViewportSize({width:844,height:390});await match(page);await page.getByRole('button',{name:'Town center',exact:true}).click();await openCommands(page,'Train');
 const recruit=page.getByRole('button',{name:'Recruit Villager',exact:true});await recruit.scrollIntoViewIfNeeded();await expect(recruit.locator('img')).toHaveAttribute('src',/villager-0\.webp$/);await recruit.click();await expect(page.getByRole('progressbar',{name:'Training Villager',exact:true})).toBeVisible();await expect(page.locator('.queue-item>.entity-portrait')).toHaveAttribute('src',/villager-0\.webp$/);await expect(page.locator('.resource.food>span')).toHaveText('950');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const viewport=page.viewportSize()!;
 const rectangles=await page.locator('.hud,.command-deck,.queue').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));for(const r of rectangles){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(viewport.width+1);expect(r.bottom).toBeLessThanOrEqual(viewport.height+1);}
 await expect(page.locator('.toast')).toHaveCount(0,{timeout:6000});await page.screenshot({path:`test-results/${info.project.name}-medieval-production-deck.png`});
});

test('the minimap camera outline follows rotation and zoom while the simulation is paused',async({page},info)=>{
 test.skip(info.project.name!=='desktop');await match(page);const map=page.locator('.minimap canvas');await expect(map).toHaveAttribute('data-camera-view','visible');await page.evaluate(()=>(window as any).__hudWorker.postMessage({type:'pause',paused:true}));await expect.poll(()=>page.evaluate(()=>(window as any).__hudSnapshot?.paused)).toBe(true);const tick=await page.evaluate(()=>(window as any).__hudSnapshot.tick);
 let before=await map.evaluate((e:HTMLCanvasElement)=>e.toDataURL());await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',key:'q'})));await expect.poll(()=>map.evaluate((e:HTMLCanvasElement)=>e.toDataURL())).not.toBe(before);
 before=await map.evaluate((e:HTMLCanvasElement)=>e.toDataURL());await page.locator('[data-testid="battlefield"] canvas').dispatchEvent('wheel',{deltaY:-250,clientX:720,clientY:320});await expect.poll(()=>map.evaluate((e:HTMLCanvasElement)=>e.toDataURL())).not.toBe(before);expect(await page.evaluate(()=>(window as any).__hudSnapshot.tick)).toBe(tick);
 await page.evaluate(()=>(window as any).__hudWorker.postMessage({type:'pause',paused:false}));await expect(page.getByRole('dialog',{name:'Game menu',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Navigate the map',exact:true}).focus();await page.keyboard.press('Enter');await expect(map).toHaveAttribute('data-camera-view','visible');await page.screenshot({path:'test-results/desktop-medieval-minimap.png'});
 expect(await page.evaluate(()=>(window as any).__mapTimers.size)).toBe(1);await page.getByRole('button',{name:'Pause match',exact:true}).click();await page.getByRole('button',{name:'Main menu',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__mapTimers.size)).toBe(0);
});

test('a missing portrait falls back to the original artwork',async({page},info)=>{
 test.skip(info.project.name!=='desktop');await page.route('**/art/portraits/villager-0.webp',route=>route.abort());await match(page);await page.getByRole('button',{name:'Idle villagers',exact:true}).click();const image=page.locator('.selection-panel>.entity-portrait');await expect(image).toHaveAttribute('src',/^data:image\/png/);await expect.poll(()=>image.evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBeGreaterThan(0);
});
