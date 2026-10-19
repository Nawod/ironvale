import {createGame,spawn} from '../../src/sim/world';
import {updateVisibility} from '../../src/sim/visibility';
import {canBuildOnTerrain,isBlockedTerrain} from '../../src/sim/terrain';
import type {UnitType} from '../../src/sim/types';
/** A model/colour comparison on generated land, with ordinary HP and rules. */
export function historicalRealmScene(night=false){
 const s=createGame({opponents:1,difficulty:'easy',seed:42,mapType:'lowlands'});s.players.forEach(p=>{p.controller='human';p.age=2;});s.tick=night?19200:1200;
 for(const e of Object.values(s.entities))if(e.kind==='unit'||e.kind==='resource'&&e.x>9&&e.x<43&&e.y>15&&e.y<38)delete s.entities[e.id];
 if(canBuildOnTerrain(s.terrain,s.size,13,24,2,s.elevation))spawn(s,'building','house',0,{x:13,y:24});
 const soldiers=[];
 for(const owner of [0,1])for(const [row,type]of (['spearman','swordsman','archer','pikeman'] as UnitType[]).entries())for(let variant=0;variant<3;variant++){
  const x=(owner?34:19)+variant*1.4,y=23+row*3;if(isBlockedTerrain(s.terrain[Math.floor(y)*s.size+Math.floor(x)]))continue;const e=spawn(s,'unit',type,owner,{x,y});e.stance='hold';soldiers.push(e);
 }
 for(const point of [{x:27,y:26},{x:27,y:34}]){const scout=spawn(s,'unit','scout',0,point);scout.stance='hold';}
 for(let i=0;i<9;i++){const x=12+i*3.2,y=17+(i%2)*.8;if(!isBlockedTerrain(s.terrain[Math.floor(y)*s.size+Math.floor(x)]))spawn(s,'resource','wood',-1,{x,y});}
 for(let i=0;i<3;i++)spawn(s,'resource','berries',-1,{x:12+i*1.5,y:29});
 s.explored[0].fill(1);updateVisibility(s);return{s,focus:{x:26,y:27},soldiers};
}
