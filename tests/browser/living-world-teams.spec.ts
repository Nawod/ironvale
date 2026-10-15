import {test,expect} from '@playwright/test';
import {closeRealmStatus,openCommands,openRealmStatus} from './hud-helpers';
import {createGame,spawn} from '../../src/sim/world';
import {updateVisibility} from '../../src/sim/visibility';
import {encodeSave} from '../../src/sim/save';
import {environmentAt,timeLabel} from '../../src/sim/environment';
import type {BuildingType,UnitType} from '../../src/sim/types';
test('online allies choose uneven teams, confirm changes and retain teams after refresh',async({page,browser},info)=>{
 test.skip(info.project.name!=='desktop');test.setTimeout(90000);const contexts=[];
 try{
  const pages=[page];for(let i=0;i<2;i++){const context=await browser.newContext({viewport:{width:1024,height:768}});contexts.push(context);pages.push(await context.newPage());}
  for(let i=0;i<3;i++){await pages[i].goto('/');await pages[i].getByRole('button',{name:'Play with Freinds',exact:true}).click();await pages[i].getByLabel('Your name').fill(`Team player ${i}`);}
  await page.getByRole('button',{name:'Create room',exact:true}).click();await page.getByLabel('Match type',{exact:true}).selectOption('teams');await page.getByRole('button',{name:'Open room',exact:true}).click();const code=await page.getByTestId('room-code').textContent();
  for(const friend of pages.slice(1)){await friend.getByRole('button',{name:'Join room',exact:true}).click();await friend.getByLabel('Room code',{exact:true}).fill(code!);await friend.getByRole('button',{name:'Join friends',exact:true}).click();}
  await page.getByRole('button',{name:'Ready',exact:true}).click();await page.getByLabel('Team for Team player 2',{exact:true}).selectOption('1');await expect(page.getByRole('button',{name:'Ready',exact:true})).toBeVisible();
  await expect(pages[1].getByLabel('Team for Team player 0',{exact:true})).toBeDisabled();await page.screenshot({path:'test-results/team-lobby.png'});
  for(const friend of pages)await friend.getByRole('button',{name:'Ready',exact:true}).click();await page.getByRole('button',{name:'Start match',exact:true}).click();
  await openRealmStatus(page);await expect(page.locator('.online-game-tag')).toContainText('Team 1');await closeRealmStatus(page);for(const friend of pages.slice(1)){await openRealmStatus(friend);await expect(friend.locator('.online-game-tag')).toContainText('Team 2');await closeRealmStatus(friend);}
  await pages[1].getByRole('button',{name:'Town center',exact:true}).click();await openCommands(pages[1],'Train');await pages[1].getByRole('button',{name:'Recruit Villager',exact:true}).click();await expect(pages[1].locator('.resource.food > span')).toHaveText('300');await expect(pages[2].locator('.resource.food > span')).toHaveText('350');
  await pages[1].reload();await openRealmStatus(pages[1]);await expect(pages[1].locator('.online-game-tag')).toContainText('Team 2');await closeRealmStatus(pages[1]);await expect(pages[1].locator('.resource.food > span')).toHaveText('300');
 }finally{await Promise.all(contexts.map(c=>c.close()));}
});
for(const scene of ['day','night','rain'] as const)test(`natural world ${scene} presentation`,async({page},info)=>{
 test.skip(info.project.name==='tablet');const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const state=createGame({opponents:1,difficulty:'normal',seed:42});for(const p of state.players)p.ai.nextThink=1e9;
 for(const [type,x,y] of [['house',23,23],['storage',23,16],['barracks',14,14],['farm',25,26],['tower',12,21],['stable',20,27]] as [BuildingType,number,number][])spawn(state,'building',type,0,{x,y});
 for(const [i,type]of (['spearman','archer','cavalry','crossbowman','heavyCavalry','pikeman'] as UnitType[]).entries())spawn(state,'unit',type,0,{x:23+i*.7,y:20});
 if(scene==='night')state.tick=19200;
 if(scene==='rain'){for(let tick=4400;tick<60000;tick+=3600){if(environmentAt(tick,42).rain>.5){state.tick=tick;break;}}expect(environmentAt(state.tick,42).rain).toBeGreaterThan(.5);}
 updateVisibility(state);await page.goto('/');await page.evaluate(async text=>{await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('ironvale-saves',1);request.onupgradeneeded=()=>request.result.createObjectStore('matches',{keyPath:'slot'});request.onsuccess=()=>{const db=request.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},encodeSave(state));
 await page.reload();await page.getByRole('button',{name:'Load saved match',exact:true}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();
 await openRealmStatus(page);const expected=environmentAt(state.tick,42),weather=page.getByTestId('world-weather');await expect(weather).toContainText(expected.weather,{ignoreCase:true});
 // Resuming advances the world clock while models/UI load; require continuity rather than one transient minute.
 const clock=(await weather.textContent())!.match(/(\d{2}):(\d{2})/)!,start=timeLabel(expected).split(':').map(Number),elapsed=(Number(clock[1])*60+Number(clock[2])-start[0]*60-start[1]+1440)%1440;expect(elapsed).toBeLessThanOrEqual(30);
 await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:30000});await expect(page.getByText('Match loaded. Resume when you are ready.',{exact:true})).toBeHidden({timeout:7000});await page.screenshot({path:`test-results/${info.project.name}-world-${scene}.png`});expect(errors).toEqual([]);
});
