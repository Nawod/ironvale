import {createGame,spawn} from '../../src/sim/world';
import {canBuildOnTerrain,TERRAIN,terrainHeight} from '../../src/sim/terrain';
import {BUILDINGS} from '../../src/sim/definitions';
import {updateVisibility} from '../../src/sim/visibility';
import type {BuildingType} from '../../src/sim/types';
/** Prepared settlement on actual generated terrain, with ordinary HP and rules. */
export function highlandsScene(){
 const s=createGame({opponents:1,difficulty:'easy',seed:778,mapType:'riverlands',mapSize:'large'});s.players.forEach(p=>{p.controller='human';p.age=2;});s.tick=1200;
 let best=-Infinity,site={x:18,y:18};
 for(let y=26;y<s.size-27;y+=2)for(let x=26;x<s.size-27;x+=2){
  if(!canBuildOnTerrain(s.terrain,s.size,x,y,3,s.elevation))continue;
  let mountain=0,water=0;for(let dy=-16;dy<=16;dy+=2)for(let dx=-16;dx<=16;dx+=2){const t=s.terrain[(y+dy)*s.size+x+dx];if(t===TERRAIN.mountain)mountain++;if(t===TERRAIN.water)water++;}
  const score=Math.min(mountain,35)*2+Math.min(water,25)-Math.abs(terrainHeight(s,x,y)-.7)*3;if(score>best){best=score;site={x,y};}
 }
 for(const e of Object.values(s.entities))if(e.kind==='unit'||e.owner===0&&e.kind==='building'||e.kind==='resource'&&e.x>=site.x-1&&e.x<site.x+4&&e.y>=site.y-1&&e.y<site.y+4)delete s.entities[e.id];
 const cap=spawn(s,'building','capital',0,site);s.players[0].capital=cap.id;
 const built=[{...site,n:3}];
 for(const type of ['house','market','barracks','farm'] as BuildingType[]){
  const n=BUILDINGS[type].size;let placed=false;
  for(let r=5;r<13&&!placed;r+=3)for(let a=0;a<12&&!placed;a++){const x=Math.round(site.x+Math.cos(a*Math.PI/6)*r),y=Math.round(site.y+Math.sin(a*Math.PI/6)*r);if(!canBuildOnTerrain(s.terrain,s.size,x,y,n,s.elevation)||built.some(b=>x<b.x+b.n+1&&x+n+1>b.x&&y<b.y+b.n+1&&y+n+1>b.y))continue;
   for(const e of Object.values(s.entities))if(e.kind==='resource'&&e.x>=x-1&&e.x<x+n+1&&e.y>=y-1&&e.y<y+n+1)delete s.entities[e.id];spawn(s,'building',type,0,{x,y});built.push({x,y,n});placed=true;}
 }
 let units=0;for(let r=3;r<=17;r+=3)for(let a=0;a<16;a++){const x=site.x+1.5+Math.cos(a*Math.PI/8)*r,y=site.y+1.5+Math.sin(a*Math.PI/8)*r,t=s.terrain[Math.floor(y)*s.size+Math.floor(x)];if(t===3||t===6||built.some(b=>x>=b.x-.3&&x<b.x+b.n+.3&&y>=b.y-.3&&y<b.y+b.n+.3))continue;spawn(s,'unit',units++<6?'villager':units%3?'spearman':'scout',0,{x,y});}
 // Existing exploration makes the valley readable while current sight still
 // comes from ordinary units; this is explicitly a staged scouting scene.
 s.explored[0].fill(1);updateVisibility(s);return{s,focus:{x:site.x+2,y:site.y+4}};
}
