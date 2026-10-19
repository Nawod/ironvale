import {createGame,spawn} from '../../src/sim/world';
import {updateVisibility} from '../../src/sim/visibility';
import type {FactionId,UnitType} from '../../src/sim/types';
/** Prepared city for model and recruitment verification, ordinary unit HP/rules. */
export function lankaScene(faction:FactionId='british',night=false){
 const s=createGame({opponents:1,difficulty:'easy',seed:42,mapType:'lowlands',faction,zombies:true,participants:[{name:'Your kingdom',controller:'human',faction},{name:'Rival kingdom',controller:'human',faction:'chola'}]});s.tick=night?19200:1200;s.players[0].age=3;s.players[0].resources={food:2000,wood:2000,stone:2000,gold:2000};
 for(const e of Object.values(s.entities))if(e.kind==='unit'||e.kind==='resource'&&e.x>9&&e.x<38&&e.y>13&&e.y<37)delete s.entities[e.id];
 const range=spawn(s,'building','range',0,{x:24,y:20}),stable=spawn(s,'building','stable',0,{x:13,y:23}),workshop=spawn(s,'building','workshop',0,{x:24,y:16});spawn(s,'building','house',0,{x:14,y:18});spawn(s,'building','tower',0,{x:29,y:20});
 const types:UnitType[]=faction==='british'?['musketeer','rifleman','cannon']:faction==='ravana'?['champion','warElephant','danduMonara']:faction==='chola'?['spearman','pikeman','warElephant']:['spearman','archer','champion','warElephant'];
 const troops=types.map((type,i)=>{const e=spawn(s,'unit',type,0,{x:18+i*3,y:26+i%2*3});e.stance='hold';return e;});
 s.explored[0].fill(1);updateVisibility(s);return{s,range,stable,workshop,troops,focus:{x:22,y:24}};
}
