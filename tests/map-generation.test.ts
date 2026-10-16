import {describe,it,expect} from 'vitest';
import {createGame} from '../src/sim/world';
import * as terrain from '../src/sim/terrain';
import {blockedGrid,canPlace,pathfind} from '../src/sim/navigation';
import {snapshot} from '../src/sim/visibility';
import {decodeSave,encodeSave} from '../src/sim/save';
import type {GameState,MatchConfig} from '../src/sim/types';

const game=(seed=42,mapType='riverlands',opponents=1,mapSize='large')=>createGame({seed,mapType,opponents,mapSize,difficulty:'normal'} as MatchConfig);
const blocked=(n:number)=>n===3||n===6;
function connected(s:GameState){
 const found=new Uint8Array(s.size*s.size),first=s.terrain.findIndex((v,i)=>!blocked(v)&&i%s.size>0&&i%s.size<s.size-1&&i>=s.size&&i<s.size*(s.size-1)),q=[first];found[first]=1;
 for(let h=0;h<q.length;h++){const i=q[h],x=i%s.size,y=Math.floor(i/s.size);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*s.size+nx;if(nx>0&&ny>0&&nx<s.size-1&&ny<s.size-1&&!found[j]&&!blocked(s.terrain[j])){found[j]=1;q.push(j);}}}
 return found;
}
describe('generated battlefields',()=>{
 it('creates larger maps for each selected size and marks the generator version',()=>{
  expect(game().size).toBe(160);expect((game().config as any).worldGeneration).toBe(2);
  for(const [mapSize,sizes] of Object.entries({standard:[128,160,192,224],large:[160,192,224,256],huge:[256,256,256,256]}))for(const [i,n] of [1,3,5,7].entries())expect(game(42,'lowlands',n,mapSize).size).toBe(sizes[i]);
  expect(()=>game(42,'riverlands',1,'tiny')).toThrow(/map size/i);
 });
 it('is deterministic but varies water shape, forest patches, hills and real mountain ridges by seed',()=>{
  const a=game(),b=game(778);
  expect(game()).toEqual(a);expect(a.terrain).not.toEqual(b.terrain);
  expect(a.terrain.filter(v=>v===3).length).toBeGreaterThan(a.size*3);
  expect(a.terrain.filter(v=>v===6).length).toBeGreaterThan(120);
  expect(a.terrain.filter(v=>v===2).length).toBeGreaterThan(300);
  const elevations=(a as any).elevation as number[];
  expect(elevations).toHaveLength((a.size+1)**2);expect(Math.max(...elevations)).toBeGreaterThan(7);
  const hillTiles=a.terrain.map((v,i)=>({v,h:terrain.terrainHeight?.(a,i%a.size+.5,Math.floor(i/a.size)+.5)??0})).filter(p=>!blocked(p.v)&&p.h>.6);
  expect(hillTiles.length).toBeGreaterThan(400);
  // New channels can run in different directions and have width variation.
  const extent=(s:GameState)=>{const water=s.terrain.flatMap((v,i)=>v===3?[{x:i%s.size,y:Math.floor(i/s.size)}]:[]);return [Math.max(...water.map(p=>p.x))-Math.min(...water.map(p=>p.x)),Math.max(...water.map(p=>p.y))-Math.min(...water.map(p=>p.y))];};
  expect(extent(a)).not.toEqual(extent(b));
 });
 it('connects all traversable land and keeps equal flat starts and unique dry resources in FFA and unequal teams',()=>{
  const teams=[0,0,0,0,1,1,1,1].map((team,i)=>({team,name:`City ${i}`,controller:i?'ai':'human'}));
  const configs=[...Array.from({length:7},(_,n)=>[game(1,'riverlands',n+1),game(777,'riverlands',n+1)]).flat(),createGame({seed:99,difficulty:'normal',opponents:7,participants:teams} as MatchConfig),game(5,'lowlands',3,'huge')];
  for(const s of configs){
   const found=connected(s);expect(s.terrain.every((v,i)=>blocked(v)||i%s.size===0||i%s.size===s.size-1||i<s.size||i>=s.size*(s.size-1)||found[i])).toBe(true);
   const resources=Object.values(s.entities).filter(e=>e.kind==='resource');expect(new Set(resources.map(e=>`${e.x},${e.y}`)).size).toBe(resources.length);
   for(const e of Object.values(s.entities))expect(blocked(s.terrain[Math.floor(e.y)*s.size+Math.floor(e.x)])).toBe(false);
   for(const p of s.players){const cap=s.entities[p.capital],local=resources.filter(e=>Math.hypot(e.x-cap.x,e.y-cap.y)<14);
    expect(local.filter(e=>e.type==='wood')).toHaveLength(18);expect(local.filter(e=>e.type==='gold')).toHaveLength(4);expect(local.filter(e=>e.type==='stone')).toHaveLength(4);expect(local.filter(e=>e.type==='berries')).toHaveLength(2);
    for(let dy=-13;dy<=13;dy++)for(let dx=-13;dx<=13;dx++)if(Math.hypot(dx,dy)<13)expect(terrain.terrainHeight?.(s,cap.x+dx,cap.y+dy)).toBeCloseTo(.2,5);
   }
  }
 });
 it('uses triangle-consistent vertex heights and rejects mountain or steep building footprints',()=>{
  expect(terrain.terrainHeight?.({size:1,elevation:[0,0,0,4]},.75,.25)).toBe(0);
  expect(terrain.terrainHeight?.({size:1,elevation:[0,0,0,4]},.75,.75)).toBe(2);
  expect(terrain.terrainHeight?.({size:2},1,1)).toBe(0);
  const s=game();s.entities={};s.terrain.fill(0);(s as any).elevation.fill(0);
  s.terrain[31*s.size+31]=6;expect(blockedGrid(s,0)[31*s.size+31]).toBe(1);expect(canPlace(s,'house',{x:30,y:30})).toBe(false);
  for(let y=26;y<=35;y++)s.terrain[y*s.size+31]=6;
  const route=pathfind(s,{x:28.5,y:31.5},{x:34.5,y:31.5},0);expect(route.length).toBeGreaterThan(10);expect(route.every(p=>s.terrain[Math.floor(p.y)*s.size+Math.floor(p.x)]!==6)).toBe(true);
  s.terrain.fill(0);
  s.terrain[31*s.size+31]=0;(s as any).elevation[31*(s.size+1)+31]=2;expect(canPlace(s,'house',{x:30,y:30})).toBe(false);
 });
 it('lets channels reach the map edge while keeping traversable foothills below mountain height',()=>{
  const s=game(),edge=s.terrain.filter((_,i)=>i%s.size===0||i%s.size===s.size-1||i<s.size||i>=s.size*(s.size-1));
  expect(edge.filter(v=>v===3).length).toBeGreaterThan(8);
  for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++)if(!blocked(s.terrain[y*s.size+x]))expect(terrain.terrainHeight(s,x+.5,y+.5)).toBeLessThanOrEqual(1.6);
 });
 it('saves generated heights and only shares vertices touching explored terrain',()=>{
  const s=game();expect(decodeSave(encodeSave(s))).toEqual(s);
  s.explored[0].fill(0);s.visible[0].fill(0);s.explored[0][30*s.size+30]=1;(s as any).elevation.fill(2);
  const heights=(snapshot(s) as any).elevation as number[];expect(heights).toHaveLength((s.size+1)**2);
  expect(heights.filter(v=>v===2)).toHaveLength(4);expect(heights[30*(s.size+1)+30]).toBe(2);expect(heights[0]).toBe(0);
 });
 it('rejects malformed height data and incompatible generation sizes while accepting legacy flat saves',()=>{
  const s=game();for(const mutate of [(b:any)=>b.elevation.pop(),(b:any)=>b.elevation[0]=null,(b:any)=>b.elevation[0]=NaN,(b:any)=>b.elevation[0]=99,(b:any)=>b.elevation[0]=-1,(b:any)=>b.elevation[0]='2',(b:any)=>delete b.elevation,(b:any)=>b.config.worldGeneration=3,(b:any)=>b.config.mapSize='tiny',(b:any)=>b.size=96]){const bad=structuredClone(s);mutate(bad);expect(()=>decodeSave(encodeSave(bad))).toThrow(/height|elevation|terrain|map|generation|damaged/i);}
  const legacy=structuredClone(s);delete (legacy.config as any).worldGeneration;delete (legacy.config as any).mapSize;delete (legacy as any).elevation;legacy.size=96;legacy.terrain=Array(96**2).fill(0);legacy.entities={};legacy.players.forEach(p=>p.alive=false);legacy.explored=legacy.players.map(()=>Array(96**2).fill(0));legacy.visible=legacy.players.map(()=>Array(96**2).fill(0));legacy.intel=legacy.players.map(()=>({}));
  expect(decodeSave(encodeSave(legacy))).toEqual(legacy);legacy.terrain[0]=6;expect(()=>decodeSave(encodeSave(legacy))).toThrow(/terrain/i);
 });
});
