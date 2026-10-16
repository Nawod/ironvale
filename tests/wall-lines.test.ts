import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {command,step} from '../src/sim/engine';
import {navigationGrids} from '../src/sim/navigation';
import {updateEconomy} from '../src/sim/economy';
import {validateCommand} from '../server/validation';
import {wallLineTiles,MAX_WALL_LINE_TILES} from '../src/sim/wall-lines';
import type {Command,Entity,GameState,Position} from '../src/sim/types';

function setup(){const s=createGame({opponents:1,difficulty:'easy',seed:42});for(const e of Object.values(s.entities))if(e.type!=='capital')delete s.entities[e.id];s.terrain.fill(0);s.visible.forEach(v=>v.fill(1));s.explored.forEach(v=>v.fill(1));s.players.forEach(p=>{p.controller='human';p.age=2;p.resources={wood:2000,stone:2000,food:2000,gold:2000};});const w=spawn(s,'unit','villager',0,{x:23,y:24});return{s,w};}
function line(s:GameState,w:Entity,start:Position={x:24,y:24},end:Position={x:26,y:25},extra:Record<string,unknown>={}){return command(s,{type:'buildWallLine',player:0,workers:[w.id],building:'palisade',start,end,...extra} as Command);}
function sites(s:GameState){return Object.values(s.entities).filter(e=>e.type==='palisade'||e.type==='wall');}
function unchanged(s:GameState,run:()=>unknown,pattern:RegExp){const before=JSON.stringify(s);expect(run()).toMatch(pattern);expect(JSON.stringify(s)).toBe(before);}

it('buys an orthogonal wall route once, queues the elbow once and resumes older gathering after normal construction',()=>{
 const{s,w}=setup(),tree=spawn(s,'resource','wood',-1,{x:22,y:24});tree.amount=10000;
 expect(command(s,{type:'order',ids:[w.id],order:{kind:'gather',target:tree.id},player:0})).toBeNull();
 expect(line(s,w,{x:24.9,y:24.8},{x:26.2,y:25.5})).toBeNull();const walls=sites(s);
 expect(walls.map(e=>[e.x,e.y])).toEqual([[24,24],[25,24],[26,24],[26,25]]);expect(s.players[0].resources.wood).toBe(1968);
 expect(walls.every(e=>e.hp===1&&e.progress===0)).toBe(true);expect(w.buildQueue).toEqual(walls.slice(1).map(e=>e.id));expect(w.taskQueue?.[0].order.target).toBe(tree.id);
 w.x=23.9;w.y=24.5;updateEconomy(s,2,navigationGrids(s));expect(walls[0].progress).toBe(.5);expect(walls[1].progress).toBe(0);
 for(let i=0;i<2400&&!(walls.every(e=>e.progress===1)&&w.order.kind==='gather');i++)step(s,1,false);
 expect(walls.every(e=>e.progress===1)).toBe(true);expect(w.order).toMatchObject({kind:'gather',target:tree.id});expect(w.buildQueue).toBeUndefined();
});
it('reuses mixed own walls free, includes unfinished sites, and rejects completed-only no-ops',()=>{
 const{s,w}=setup(),a=spawn(s,'building','wall',0,{x:24,y:24}),b=spawn(s,'building','palisade',0,{x:25,y:24});b.progress=.5;
 expect(line(s,w,{x:24,y:24},{x:26,y:24})).toBeNull();expect(sites(s)).toHaveLength(3);expect(s.players[0].resources.wood).toBe(1992);expect(w.order.target).toBe(b.id);expect(w.buildQueue).toHaveLength(1);expect(a.type).toBe('wall');
 unchanged(s,()=>line(s,w,{x:24,y:24},{x:24,y:24}),/already built/i);
});
it('checks visibility of the entire route before hidden occupancy or terrain',()=>{
 for(const hidden of ['terrain','enemy','resource']){const{s,w}=setup();s.visible[0][24*s.size+26]=0;
  if(hidden==='terrain')s.terrain[24*s.size+24]=3;else if(hidden==='enemy')spawn(s,'building','wall',1,{x:24,y:24});else spawn(s,'resource','wood',-1,{x:24,y:24});
  unchanged(s,()=>line(s,w,{x:24,y:24},{x:26,y:24}),/scout/i);
 }
});
it.each(['water','bridge','ford','gate','house','enemy','resource','ruin'])('rejects a route blocked by %s atomically',kind=>{
 const{s,w}=setup();if(['water','bridge','ford'].includes(kind))s.terrain[24*s.size+26]=kind==='water'?3:kind==='bridge'?5:4;
 else if(kind==='resource')spawn(s,'resource','berries',-1,{x:26,y:24});else{const b=spawn(s,'building',kind==='house'?'house':kind==='gate'?'gate':'wall',kind==='enemy'?1:0,{x:26,y:24});if(kind==='ruin')b.hp=0;}
 unchanged(s,()=>line(s,w,{x:24,y:24},{x:27,y:24}),/clear land/i);
});
it('rejects insufficient funds, locked stone walls, invalid routes and no usable workers without mutation',()=>{
 const{s,w}=setup();s.players[0].resources.wood=8;unchanged(s,()=>line(s,w),/resources/i);s.players[0].age=1;unchanged(s,()=>line(s,w,undefined,undefined,{building:'wall'}),/advance/i);
 for(const [start,end]of [[{x:NaN,y:24},{x:25,y:24}],[{x:24,y:24},{x:90,y:24}],[{x:0,y:24},{x:25,y:24}],[{x:94,y:24},{x:94,y:24}]] as [Position,Position][])unchanged(s,()=>line(s,w,start,end),/line|map|land/i);
 for(const extra of [{workers:[]},{workers:[-1]},{workers:[w.id+100]},{workers:Array(1001).fill(w.id)},{building:'gate'}])unchanged(s,()=>line(s,w,undefined,undefined,extra),/villager|selection|wall/i);
 for(const extra of [{hp:0},{owner:1},{garrisoned:123},{kind:'resource' as const}]){Object.assign(w,{hp:55,owner:0,garrisoned:undefined,kind:'unit'},extra);unchanged(s,()=>line(s,w),/villager/i);}
});
it('rejects everyone atomically if one selected worker cannot remember the entire new line',()=>{
 const{s,w}=setup(),other=spawn(s,'unit','villager',0,{x:23,y:25});other.order={kind:'move',point:{x:30,y:30}};other.taskQueue=Array.from({length:127},(_,i)=>({order:{kind:'move' as const,point:{x:35+i%10,y:35+Math.floor(i/10)}}}));
 unchanged(s,()=>line(s,w,{x:24,y:24},{x:26,y:24},{workers:[w.id,other.id]}),/task list is full/i);
});
it('appends wooden and stone wall lines to active fortifications in FIFO order without duplicate jobs',()=>{
 const{s,w}=setup();expect(line(s,w,{x:24,y:24},{x:25,y:24})).toBeNull();const first=sites(s).map(e=>e.id);expect(line(s,w,{x:25,y:24},{x:27,y:24},{building:'wall'})).toBeNull();
 expect(w.order.target).toBe(first[0]);expect(w.buildQueue).toEqual(sites(s).slice(1).map(e=>e.id));expect(w.taskQueue).toBeUndefined();expect(s.players[0].resources.stone).toBe(1976);
 expect(line(s,w,{x:24,y:24},{x:27,y:24})).toBeNull();expect(w.buildQueue).toHaveLength(3);expect(s.players[0].resources.wood).toBe(1984);
});
it('individual wooden segments preserve the same FIFO continuation as stone segments',()=>{
 const{s,w}=setup();for(const x of [24,25,26])expect(command(s,{type:'build',player:0,workers:[w.id],building:'palisade',point:{x,y:24}})).toBeNull();
 expect(w.order.target).toBe(sites(s)[0].id);expect(w.buildQueue).toEqual(sites(s).slice(1).map(e=>e.id));expect(w.taskQueue).toBeUndefined();
});
it('shares bounded reversed, vertical, single-tile and maximum-length routes without mutating endpoints',()=>{
 const start={x:5.9,y:8.2},end={x:3.7,y:6.4};expect(wallLineTiles(start,end)).toEqual([{x:5,y:8},{x:4,y:8},{x:3,y:8},{x:3,y:7},{x:3,y:6}]);expect(start).toEqual({x:5.9,y:8.2});expect(end).toEqual({x:3.7,y:6.4});
 expect(wallLineTiles({x:5,y:8},{x:5,y:6})).toEqual([{x:5,y:8},{x:5,y:7},{x:5,y:6}]);expect(wallLineTiles({x:5,y:8},{x:5,y:8})).toEqual([{x:5,y:8}]);
 expect(wallLineTiles({x:1,y:1},{x:MAX_WALL_LINE_TILES,y:1})).toHaveLength(64);expect(wallLineTiles({x:1,y:1},{x:65,y:1})).toBeUndefined();
 for(const value of [NaN,Infinity,-1,193,Number.MAX_SAFE_INTEGER])expect(wallLineTiles({x:value,y:1},{x:1,y:1})).toBeUndefined();
});
it('accepts the exact task capacity boundary and reuses uncompleted sites without a purchase',()=>{
 const{s,w}=setup(),a=spawn(s,'building','palisade',0,{x:24,y:24}),b=spawn(s,'building','wall',0,{x:25,y:24});a.progress=.1;b.progress=.2;
 w.order={kind:'move',point:{x:30,y:30}};w.taskQueue=Array.from({length:126},(_,i)=>({order:{kind:'move' as const,point:{x:35+i%10,y:35+Math.floor(i/10)}}}));
 expect(line(s,w,{x:24,y:24},{x:25,y:24})).toBeNull();expect(w.taskQueue).toHaveLength(127);expect(w.order.target).toBe(a.id);expect(w.buildQueue).toEqual([b.id]);expect(s.players[0].resources.wood).toBe(2000);
});
it('keeps each worker previous job when a temporary task interrupts a whole wall line',()=>{
 const{s,w}=setup(),other=spawn(s,'unit','villager',0,{x:23,y:25}),wood=spawn(s,'resource','wood',-1,{x:22,y:24}),food=spawn(s,'resource','berries',-1,{x:22,y:25});wood.amount=10000;food.amount=10000;
 for(const [worker,target]of [[w,wood],[other,food]])expect(command(s,{type:'order',player:0,ids:[worker.id],order:{kind:'gather',target:target.id}})).toBeNull();
 expect(line(s,w,{x:24,y:24},{x:26,y:24},{workers:[w.id,w.id,other.id]})).toBeNull();const walls=sites(s);
 expect(command(s,{type:'order',player:0,ids:[w.id,other.id],order:{kind:'move',point:{x:23,y:27}}})).toBeNull();
 for(const worker of [w,other])expect(worker.taskQueue?.[0].buildQueue).toEqual(walls.slice(1).map(e=>e.id));
 for(let i=0;i<2400&&!(walls.every(e=>e.progress===1)&&w.order.kind==='gather'&&other.order.kind==='gather');i++)step(s,1,false);
 expect(walls.every(e=>e.progress===1)).toBe(true);expect(w.order).toMatchObject({kind:'gather',target:wood.id});expect(other.order).toMatchObject({kind:'gather',target:food.id});expect(s.players[0].resources.wood).toBe(1976);
});
it('validates wall line commands for online transport and ignores forged player IDs',()=>{
 const c={type:'buildWallLine',player:7,building:'palisade',start:{x:24.5,y:24},end:{x:26,y:25},workers:[1,1,2]};
 expect(validateCommand(c)).toEqual({...c,player:0,workers:[1,2]});
 for(const patch of [{building:'gate'},{building:'house'},{start:{x:NaN,y:2}},{end:{x:193,y:4}},{end:{x:90,y:24}},{workers:[]},{workers:[0]},{workers:Array(1001).fill(1)},{workers:'1'}])expect(()=>validateCommand({...c,...patch})).toThrow(/invalid/i);
});
