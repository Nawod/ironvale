import {createGame,spawn} from '../../src/sim/world';
import {updateVisibility} from '../../src/sim/visibility';
import {canBuildOnTerrain,generateRiverlands} from '../../src/sim/terrain';
import {BUILDINGS} from '../../src/sim/definitions';
import {environmentAt} from '../../src/sim/environment';
import type {BuildingType} from '../../src/sim/types';
/** Controlled legacy crossing arena, not a sample of the random generator. */
export function riverValleyScene(weather:'day'|'rain'='day'){
 const s=createGame({opponents:1,difficulty:'easy',seed:42,mapType:'riverlands'});s.terrain.fill(0);s.elevation?.fill(0);generateRiverlands(s.terrain,s.size,42,s.players.map(p=>s.entities[p.capital]));const row=Math.round(s.size*.33),tiles=s.terrain.slice(row*s.size,(row+1)*s.size),left=tiles.indexOf(5),right=tiles.lastIndexOf(5),focus={x:(left+right+1)/2-2,y:row+2};
 s.players.forEach(p=>{p.controller='human';p.age=2;});s.tick=1200;
 for(const e of Object.values(s.entities))if(e.kind==='resource'&&s.terrain[Math.floor(e.y)*s.size+Math.floor(e.x)]===3)delete s.entities[e.id];
 if(weather==='rain')for(let tick=4400;tick<100000;tick+=3600){const e=environmentAt(tick,42);if(e.rain>.5&&e.daylight>.65){s.tick=tick;break;}}
 for(const e of Object.values(s.entities))if(e.kind==='unit'||e.kind==='resource'&&Math.hypot(e.x-focus.x,e.y-focus.y)<26)delete s.entities[e.id];
 const cap=s.entities[s.players[0].capital];cap.x=left-9;cap.y=row-2;
 const place=(type:BuildingType,x:number,y:number)=>{const n=BUILDINGS[type].size;if(!canBuildOnTerrain(s.terrain,s.size,x,y,n))throw new Error(`Wet showcase footprint: ${type}`);return spawn(s,'building',type,0,{x,y});};
 place('house',left-14,row-3);place('market',left-14,row+3);place('barracks',left-6,row+5);place('farm',left-10,row+5);place('outpost',right+4,row-2);
 for(let i=0;i<18;i++){const x=left-18+i%4*1.25,y=row-8+Math.floor(i/4)*1.15;if(canBuildOnTerrain(s.terrain,s.size,x,y,1))spawn(s,'resource','wood',-1,{x,y});}
 for(let i=0;i<12;i++){const x=right+7+i%3*1.3,y=row+5+Math.floor(i/3)*1.1;if(canBuildOnTerrain(s.terrain,s.size,x,y,1))spawn(s,'resource','wood',-1,{x,y});}
 for(let i=0;i<4;i++)spawn(s,'resource','stone',-1,{x:left-16+i*.65,y:row+4});spawn(s,'resource','berries',-1,{x:left-5,y:row-5});
 for(let i=0;i<8;i++)spawn(s,'unit',i<3?'spearman':i<6?'archer':'cavalry',0,{x:left-3+i%3*.8,y:row+Math.floor(i/3)*.7});
 for(const point of [{x:left-9,y:row+4},{x:right+4,y:row+5},{x:left-2,y:row-6},{x:right+2,y:row-7}])spawn(s,'unit','scout',0,point);
 spawn(s,'unit','villager',0,{x:left-10,y:row+3});spawn(s,'unit','villager',0,{x:left-4,y:row+6});s.explored[0].fill(1);updateVisibility(s);return{s,focus};
}
