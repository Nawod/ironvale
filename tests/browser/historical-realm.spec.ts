import {test,expect,type Page} from '@playwright/test';
import {historicalRealmScene} from '../fixtures/historical-realm';
import {encodeSave,decodeSave} from '../../src/sim/save';
import {RTSCamera} from '../../src/render/camera3d';
import {terrainHeight} from '../../src/sim/terrain';
import {openCommands} from './hud-helpers';

async function load(page:Page,night=false){
 const fixture=historicalRealmScene(night);decodeSave(encodeSave(fixture.s));await page.goto('/');await page.evaluate(text=>new Promise<void>(resolve=>{const r=indexedDB.open('ironvale-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('matches',{keyPath:'slot'});r.onsuccess=()=>{const tx=r.result.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{r.result.close();resolve();};};}),encodeSave(fixture.s));await page.reload();await page.getByRole('button',{name:'Load saved match',exact:true}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();
 const canvas=page.locator('[data-testid="battlefield"] canvas');await expect(canvas).toHaveAttribute('data-model-detail','ready',{timeout:40000});await expect(canvas).toHaveAttribute('data-historical-actors','ready');await expect(canvas).toHaveAttribute('data-historical-nature','ready');await expect(canvas).toHaveAttribute('data-terrain-materials','ready');
 const map=page.locator('.minimap canvas');if(!await map.isVisible())await page.getByRole('button',{name:'Show minimap',exact:true}).click();const r=(await map.boundingBox())!;await page.mouse.click(r.x+fixture.focus.x/fixture.s.size*r.width,r.y+fixture.focus.y/fixture.s.size*r.height);await expect(page.locator('.toast')).toHaveCount(0,{timeout:6000});return{...fixture,canvas};
}
for(const night of [false,true])test(`native historical troops and woodlands render at ${night?'night':'day'} with bounded shared assets`,async({page},info)=>{
 test.setTimeout(90000);if(info.project.name==='phone')await page.setViewportSize({width:844,height:390});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});const{canvas}=await load(page,night),metrics=JSON.parse((await canvas.getAttribute('data-historical-metrics'))!);expect(metrics.actors.liveMixers).toBe(0);expect(metrics.actors.geometries).toBeLessThan(500);expect(metrics.nature.templates).toBe(7);expect(metrics.actors.textures).toBe(18);
 const v=page.viewportSize()!;await page.mouse.move(v.width/2,v.height*.42);await page.mouse.wheel(0,300);await page.screenshot({path:`test-results/${info.project.name}-historical-${night?'night':'day'}.png`});if(info.project.name==='phone'&&!night){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/phone-portrait-historical.png'});}expect(errors).toEqual([]);
});
test('selecting a historical archer exposes readable counters and potential downhill range',async({page},info)=>{
 test.setTimeout(90000);if(info.project.name==='phone')await page.setViewportSize({width:844,height:390});const{s,soldiers}=await load(page),archer=soldiers.find(e=>e.owner===0&&e.type==='archer')!,v=page.viewportSize()!,camera=new RTSCamera();
 // Center the desired soldier using normal minimap navigation. The comparison
 // scene's leftmost archer otherwise sits beneath the compact top toolbar.
 const map=page.locator('.minimap canvas');if(!await map.isVisible())await page.getByRole('button',{name:'Show minimap',exact:true}).click();const r=(await map.boundingBox())!,click={x:Math.round(r.x+archer.x/s.size*r.width),y:Math.round(r.y+archer.y/s.size*r.height)};await page.mouse.click(click.x,click.y);
 // A CSS pixel covers roughly one world tile here. Derive the real center from
 // integer input coordinates rather than assuming an exact subpixel map click.
 const focus={x:(click.x-r.x)/r.width*s.size,y:(click.y-r.y)/r.height*s.size};
 camera.configure({...v,focus,zoom:v.width<600?.92:1.1,yaw:Math.PI/4,origin:v.width<700?.44:.42});const p=camera.project(archer,terrainHeight(s,archer.x,archer.y)+.6);await page.mouse.click(p.x,p.y);await expect(page.locator('.selection-panel h2')).toHaveText('Archer');await openCommands(page,'Orders');const tactics=page.getByLabel('Unit tactics',{exact:true});await tactics.scrollIntoViewIfNeeded();await expect(tactics).toContainText('up to 7.2 downhill');expect(await tactics.evaluate(e=>parseFloat(getComputedStyle(e.querySelector('small')!).fontSize))).toBeGreaterThanOrEqual(14);await page.screenshot({path:`test-results/${info.project.name}-historical-tactics.png`});
});
