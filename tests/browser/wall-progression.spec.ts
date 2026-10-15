import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {createGame,spawn} from '../../src/sim/world';
import {encodeSave} from '../../src/sim/save';
import {updateVisibility} from '../../src/sim/visibility';
import {RTSCamera} from '../../src/render/camera3d';
import {openCommands} from './hud-helpers';

async function wallMatch(page:Page,age:1|2|3,stone=false){
 const state=createGame({opponents:1,difficulty:'easy',seed:42});state.players.forEach(player=>player.controller='human');state.players[0].age=age;state.players[0].resources={food:1000,wood:1000,stone:1000,gold:500};
 const wall=spawn(state,'building',stone?'wall':'palisade',0,{x:22,y:22});if(stone)wall.hp=wall.maxHp/2;updateVisibility(state);
 await page.goto('/');await page.evaluate(async text=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('ironvale-saves',1);request.onupgradeneeded=()=>request.result.createObjectStore('matches',{keyPath:'slot'});request.onsuccess=()=>{const db=request.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),encodeSave(state));
 await page.reload();await page.getByRole('button',{name:'Load saved match',exact:true}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();
}
async function selectWall(page:Page,info:TestInfo){
 if(await page.getByRole('button',{name:'Close commands',exact:true}).isVisible())await page.getByRole('button',{name:'Close commands',exact:true}).click();
 await page.getByRole('button',{name:'Town center',exact:true}).click();const viewport=page.viewportSize()!,camera=new RTSCamera();camera.configure({...viewport,focus:{x:18,y:18},zoom:viewport.width<600?.92:1.1,yaw:Math.PI/4,origin:viewport.width<700?.44:.42});const point=camera.project({x:22.5,y:22.5},.5);
 if(info.project.name==='desktop')await page.mouse.click(point.x,point.y);else await page.touchscreen.tap(point.x,point.y);
 await openCommands(page,'Improve');
}
test('wooden walls start unlocked and explain the next town-hall requirement',async({page},info)=>{
 await wallMatch(page,1);await page.getByRole('button',{name:'Idle villagers',exact:true}).click();await openCommands(page,'Build');await expect(page.getByRole('button',{name:'Build Wooden wall',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Build Stone wall',exact:true})).toBeDisabled();
 await selectWall(page,info);await expect(page.getByRole('heading',{name:'Wooden wall',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Upgrade to Stone wall',exact:true})).toBeDisabled();await expect(page.getByText('Requires town hall level 2',{exact:true})).toBeVisible();
});
test('an owned wooden wall upgrades to stone with a paid visible timer',async({page},info)=>{
 await wallMatch(page,2);await selectWall(page,info);const upgrade=page.getByRole('button',{name:'Upgrade to Stone wall',exact:true});await expect(upgrade).toBeEnabled();await expect(upgrade).toContainText('6s upgrade');await upgrade.click();await expect(page.locator('.resource.stone > span')).toHaveText('988');await expect(page.getByText('Upgrading to Stone wall',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Stone wall',exact:true})).toBeVisible({timeout:12000});await expect(page.getByRole('button',{name:'Upgrade to Reinforced stone wall',exact:true})).toBeDisabled();await page.screenshot({path:`test-results/${info.project.name}-stone-wall-upgrade.png`});
});
test('third-age reinforcement keeps existing wall damage',async({page},info)=>{
 await wallMatch(page,3,true);await selectWall(page,info);await expect(page.locator('.selection-panel')).toContainText('400 / 800 health');await page.getByRole('button',{name:'Upgrade to Reinforced stone wall',exact:true}).click();await expect(page.locator('.resource.stone > span')).toHaveText('976');await expect(page.locator('.resource.gold > span')).toHaveText('492');
 await expect(page.getByRole('heading',{name:'Reinforced stone wall',exact:true})).toBeVisible({timeout:15000});await expect(page.locator('.selection-panel')).toContainText('700 / 1400 health');await expect(page.getByText('Maximum wall strength',{exact:true})).toBeVisible();
});
