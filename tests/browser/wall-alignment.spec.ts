import {test,expect} from '@playwright/test';
import {createGame,spawn} from '../../src/sim/world';
import {encodeSave} from '../../src/sim/save';
test('enclosure walls face along both sides',async({page},info)=>{
 const s=createGame({opponents:1,difficulty:'easy',seed:42});s.players.forEach(p=>p.controller='human');for(const e of Object.values(s.entities))if(e.kind==='resource'&&e.x>=12&&e.x<=29&&e.y>=12&&e.y<=29)delete s.entities[e.id];
 for(let x=14;x<=26;x++){spawn(s,'building','palisade',0,{x,y:14});spawn(s,'building','palisade',0,{x,y:26});}for(let y=15;y<26;y++){spawn(s,'building','palisade',0,{x:14,y});spawn(s,'building','palisade',0,{x:26,y});}
 await page.goto('/');await page.evaluate(async text=>new Promise<void>(resolve=>{const r=indexedDB.open('ironvale-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('matches',{keyPath:'slot'});r.onsuccess=()=>{const db=r.result,tx=db.transaction('matches','readwrite');tx.objectStore('matches').put({slot:'manual',text,date:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};};}),encodeSave(s));await page.reload();await page.getByRole('button',{name:'Load saved match',exact:true}).click();await page.getByRole('button',{name:'Resume match',exact:true}).click();await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:40000});await page.screenshot({path:`test-results/${info.project.name}-wall-alignment.png`});
});
