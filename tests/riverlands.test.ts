import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {blockedGrid,buildingSize,canPlace,navigationGrids,pathfind,travel} from '../src/sim/navigation';
import {formationDestinations} from '../src/sim/formations';
import {applyCommand,updateEconomy} from '../src/sim/economy';
import {separateUnits} from '../src/sim/physics';
import {step} from '../src/sim/engine';
import {updateCombat} from '../src/sim/combat';
import {encodeSave,decodeSave} from '../src/sim/save';
import type {GameState,MatchConfig} from '../src/sim/types';
import {isBlockedTerrain} from '../src/sim/terrain';

const river=(opponents=1,seed=42,participants?:MatchConfig['participants'])=>createGame({opponents,seed,difficulty:'normal',mapType:'riverlands',participants} as MatchConfig);
const cell=(s:GameState,p:{x:number;y:number})=>Math.floor(p.y)*s.size+Math.floor(p.x);
function arena(){const s=createGame({opponents:1,difficulty:'normal',seed:42});s.entities={};s.terrain.fill(0);s.elevation?.fill(0);s.visible.forEach(v=>v.fill(1));s.explored.forEach(v=>v.fill(1));for(let y=0;y<s.size;y++)for(let x=45;x<=51;x++)s.terrain[y*s.size+x]=y>=38&&y<=41?5:3;return s;}
function enclosedGarrison(){const s=arena(),tower=spawn(s,'building','tower',0,{x:52,y:30}),unit=spawn(s,'unit','archer',0,{x:52,y:30});tower.garrison=[unit.id];unit.garrisoned=tower.id;const n=buildingSize(tower);for(let y=20;y<=40;y++)for(let x=52;x<=62;x++)if(x<tower.x||x>=tower.x+n||y<tower.y||y>=tower.y+n)spawn(s,'building','wall',0,{x,y});return {s,tower,unit};}

it('recreates the seeded generated Lowlands world when map choice is absent or explicit',()=>{
 for(const opponents of [1,3,7]){const config={opponents,difficulty:'normal',seed:42} as MatchConfig,s=createGame(config);expect(s.config.worldGeneration).toBe(2);expect(createGame(config)).toEqual(s);const explicit=createGame({...s.config,mapType:'lowlands'});delete explicit.config.mapType;expect(explicit).toEqual(s);expect(createGame({...config,seed:777}).terrain).not.toEqual(s.terrain);}
});
it('generates a broad deterministic river with both permanent bridge and ford crossings',()=>{
 const s=river();expect(s.terrain.filter(v=>v===3).length).toBeGreaterThan(s.size*3);expect(s.terrain.filter(v=>v===4).length).toBeGreaterThan(10);expect(s.terrain.filter(v=>v===5).length).toBeGreaterThan(10);expect(river()).toEqual(s);expect(river(1,777).terrain).not.toEqual(s.terrain);
});
it('keeps every start, its resources and the entire land network connected for 2–8 empires and unequal teams',()=>{
 const configs:Array<[number,MatchConfig['participants']?]>=Array.from({length:7},(_,i)=>[i+1]);
 for(const teams of [[0,0,0,0,1],[0,0,0,0,1,1,1,1],[0,0,0,1,1,2,2,2],[0,0,1]])configs.push([teams.length-1,teams.map((team,i)=>({team,name:`City ${i}`,controller:i===0?'human':'ai'}))]);
 for(const [n,participants] of configs)for(const seed of [1,42,777]){
  const s=river(n,seed,participants),seen=new Uint8Array(s.size*s.size),cap=s.entities[s.players[0].capital],first=cell(s,cap),queue=[first];seen[first]=1;
  for(let h=0;h<queue.length;h++){const id=queue[h],x=id%s.size,y=Math.floor(id/s.size);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,next=ny*s.size+nx;if(nx>0&&ny>0&&nx<s.size-1&&ny<s.size-1&&!seen[next]&&!isBlockedTerrain(s.terrain[next])){seen[next]=1;queue.push(next);}}}
  let unreachable=0;for(let y=1;y<s.size-1;y++)for(let x=1;x<s.size-1;x++)if(!isBlockedTerrain(s.terrain[y*s.size+x])&&!seen[y*s.size+x])unreachable++;
  expect(unreachable,`unreachable land for ${n+1} empires, seed ${seed}`).toBe(0);
  for(const p of s.players){const city=s.entities[p.capital];let unsafe=0;for(let y=city.y-15;y<=city.y+15;y++)for(let x=city.x-15;x<=city.x+15;x++)if(Math.hypot(x-city.x,y-city.y)<=15&&s.terrain[y*s.size+x]>=3)unsafe++;expect(unsafe,`unsafe start ${n},${seed},${p.id}`).toBe(0);}
  expect(Object.values(s.entities).every(e=>!isBlockedTerrain(s.terrain[cell(s,e)])&&seen[cell(s,e)])).toBe(true);
 }
});
it('blocks deep water for every owner and routes armies through crossings',()=>{
 const s=arena(),grid=blockedGrid(s,0);expect(grid[30*s.size+48]).toBe(1);expect(grid[40*s.size+48]).toBe(0);
 const route=pathfind(s,{x:40.5,y:30.5},{x:55.5,y:30.5},0,grid);expect(route.length).toBeGreaterThan(20);expect(route.some(p=>p.y>=38&&p.y<42&&p.x>=45&&p.x<52)).toBe(true);expect(route.every(p=>s.terrain[cell(s,p)]!==3)).toBe(true);expect(blockedGrid(s,-2)[30*s.size+48]).toBe(1);
});
it('keeps formation slots, actual travel and crowd displacement out of water',()=>{
 const s=arena(),units=Array.from({length:12},(_,i)=>spawn(s,'unit','spearman',0,{x:43.97,y:28.5+i*.07}));
 const slots=formationDestinations(s,units,{x:48.5,y:30.5});expect([...slots.values()].every(p=>s.terrain[cell(s,p)]!==3)).toBe(true);
 const grids=navigationGrids(s);for(const e of units)e.order={kind:'move',point:slots.get(e.id)};
 for(let i=0;i<100;i++){s.tick++;for(const e of units)travel(s,e,slots.get(e.id)!,.05,grids[0]);separateUnits(s,grids);expect(units.every(e=>s.terrain[cell(s,e)]!==3)).toBe(true);}
});
it('walks an army across a bridge without clipping a water tile between waypoints',()=>{
 const s=arena(),unit=spawn(s,'unit','spearman',0,{x:40.97,y:30.03}),grid=blockedGrid(s,0),goal={x:55.5,y:30.5};
 let arrived=false;for(let i=0;i<600&&!arrived;i++){s.tick++;arrived=travel(s,unit,goal,.05,grid);expect(s.terrain[cell(s,unit)]).not.toBe(3);}
 expect(arrived).toBe(true);expect(unit.x).toBeCloseTo(goal.x,0);expect(unit.y).toBeCloseTo(goal.y,0);
});
it.each([3,4,5,6])('rejects construction and relocation across terrain %s without mutating state',value=>{
 const s=arena();s.terrain[31*s.size+31]=value;const b=spawn(s,'building','house',0,{x:20,y:30}),w=spawn(s,'unit','villager',0,{x:25,y:30});expect(canPlace(s,'house',{x:30,y:30})).toBe(false);const before=structuredClone(s);
 expect(applyCommand(s,{type:'build',player:0,building:'house',point:{x:30,y:30},workers:[w.id]})).toBeTruthy();expect(s).toEqual(before);
 expect(applyCommand(s,{type:'moveBuilding',player:0,building:b.id,point:{x:30,y:30}})).toBeTruthy();expect(s).toEqual(before);
});
it('waits for a dry recruit exit rather than spawning into surrounding water',()=>{
 const s=arena(),b=spawn(s,'building','capital',0,{x:25,y:25});s.players[0].capital=b.id;
 for(let y=20;y<=33;y++)for(let x=20;x<=33;x++)if(x<25||x>=28||y<25||y>=28)s.terrain[y*s.size+x]=3;
 b.queue=[{kind:'unit',unit:'villager',remaining:0,total:10,cost:{food:50}}];updateEconomy(s,.05,navigationGrids(s));expect(b.queue).toHaveLength(1);expect(Object.values(s.entities).filter(e=>e.kind==='unit')).toHaveLength(0);
 s.terrain=s.terrain.slice();s.terrain[29*s.size+29]=0;updateEconomy(s,.05,navigationGrids(s));expect(b.queue).toHaveLength(0);expect(Object.values(s.entities).find(e=>e.kind==='unit')).toMatchObject({x:29.5,y:29.5});
});
it('keeps resources, wildlife and nighttime zombie spawns on valid terrain after simulation',()=>{
 const s=river(3);s.config.zombies=true;s.tick=11999;step(s,100,false);expect(Object.values(s.entities).some(e=>e.type==='zombie')).toBe(true);expect(Object.values(s.entities).filter(e=>!e.garrisoned).every(e=>!isBlockedTerrain(s.terrain[cell(s,e)]))).toBe(true);
 const restored=decodeSave(encodeSave(s));expect(restored).toEqual(s);step(s,40,false);step(restored,40,false);expect(restored).toEqual(s);
});
it('finds a dry garrison exit when the old western exit lies in a river',()=>{
 const s=arena(),tower=spawn(s,'building','tower',0,{x:52,y:30}),unit=spawn(s,'unit','archer',0,{x:52,y:30});tower.garrison=[unit.id];unit.garrisoned=tower.id;
 expect(applyCommand(s,{type:'ungarrison',player:0,building:tower.id})).toBeNull();expect(unit.garrisoned).toBeUndefined();expect(s.terrain[cell(s,unit)]).not.toBe(3);expect(blockedGrid(s,0)[cell(s,unit)]).toBe(0);
});
it('keeps an enclosed garrison in its tower rather than teleporting across the river or walls',()=>{
 const {s,tower,unit}=enclosedGarrison(),before=structuredClone(s);
 const error=applyCommand(s,{type:'ungarrison',player:0,building:tower.id});expect(error).not.toBeNull();expect(error).toMatch(/space|clear/i);expect(s).toEqual(before);expect(unit.garrisoned).toBe(tower.id);
});
it('releases a destroyed enclosed garrison onto its former footprint without teleporting',()=>{
 const {s,tower,unit}=enclosedGarrison(),attacker=spawn(s,'unit','trebuchet',1,{x:64,y:30});tower.hp=1;attacker.order={kind:'attack',target:tower.id};updateCombat(s,.05,navigationGrids(s));
 expect(s.entities[tower.id]).toBeUndefined();expect(unit.garrisoned).toBeUndefined();expect(unit.x).toBeGreaterThanOrEqual(tower.x);expect(unit.x).toBeLessThan(tower.x+buildingSize(tower));expect(unit.y).toBeGreaterThanOrEqual(tower.y);expect(unit.y).toBeLessThan(tower.y+buildingSize(tower));expect(s.terrain[cell(s,unit)]).not.toBe(3);
});
it.each(['build','moveBuilding'] as const)('does not disclose hidden terrain or occupants through %s rejection messages',type=>{
 const errors:string[]=[];
 for(const terrain of [0,3,4,5,6])for(const hiddenBuilding of [false,true]){
  const s=arena(),b=spawn(s,'building','house',0,{x:20,y:30}),w=spawn(s,'unit','villager',0,{x:25,y:30}),point={x:30,y:30};
  s.terrain[31*s.size+31]=terrain;s.visible[0][31*s.size+31]=0;s.explored[0][31*s.size+31]=0;if(hiddenBuilding)spawn(s,'building','wall',1,{x:31,y:31});
  const before=structuredClone(s),error=type==='build'?applyCommand(s,{type,player:0,building:'house',point,workers:[w.id]}):applyCommand(s,{type,player:0,building:b.id,point});
  expect(error).toMatch(/scout/i);errors.push(error!);expect(s).toEqual(before);
 }
 expect(new Set(errors).size).toBe(1);
});
it('rejects saved routes and defensive refuges in deep water',()=>{
 const s=river(),water=s.terrain.indexOf(3),point={x:water%s.size+.5,y:Math.floor(water/s.size)+.5},unit=Object.values(s.entities).find(e=>e.kind==='unit')!;
 unit.path=[point];expect(()=>decodeSave(encodeSave(s))).toThrow(/terrain|water|path/i);unit.path=[];unit.home=point;expect(()=>decodeSave(encodeSave(s))).toThrow(/terrain|water|home/i);
});
it('round-trips Riverlands and rejects invalid map names, terrain codes and water entity data',()=>{
 const s=river();expect(decodeSave(encodeSave(s))).toEqual(s);
 for(const value of ['ocean',null,3]){const bad=structuredClone(s);(bad.config as any).mapType=value;expect(()=>decodeSave(encodeSave(bad))).toThrow(/map|terrain/i);expect(()=>createGame(bad.config)).toThrow(/map|terrain/i);}
 for(const value of [-1,7,1.5,null]){const bad=structuredClone(s);(bad.terrain as any)[0]=value;expect(()=>decodeSave(encodeSave(bad))).toThrow(/map|terrain/i);}
 const bad=structuredClone(s),water=bad.terrain.indexOf(3),unit=Object.values(bad.entities).find(e=>e.kind==='unit')!;unit.x=water%bad.size+.5;unit.y=Math.floor(water/bad.size)+.5;expect(()=>decodeSave(encodeSave(bad))).toThrow(/map|terrain|water/i);
 const old=createGame({opponents:1,difficulty:'normal',seed:42});expect(decodeSave(encodeSave(old))).toEqual(old);
});
