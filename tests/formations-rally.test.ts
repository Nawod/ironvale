import {it,expect} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {command,step} from '../src/sim/engine';
import {updateEconomy} from '../src/sim/economy';
import {navigationGrids,pathfind} from '../src/sim/navigation';
import {snapshot,updateVisibility} from '../src/sim/visibility';
import {encodeSave,decodeSave} from '../src/sim/save';
import {updateConquest} from '../src/sim/combat';
import {validateCommand,validateMessage} from '../server/validation';
import type {Command,Entity,GameState,Position} from '../src/sim/types';

function setup(){
 const s=createGame({opponents:1,difficulty:'easy',seed:42});
 for(const e of Object.values(s.entities))if(e.type!=='capital')delete s.entities[e.id];
 s.players.forEach(p=>{p.controller='human';p.resources={food:1000,wood:1000,stone:1000,gold:1000};});
 s.visible.forEach(a=>a.fill(1));s.explored.forEach(a=>a.fill(1));return s;
}
const submit=(s:GameState,c:any)=>command(s,c as Command);
function army(s:GameState,n=12){return Array.from({length:n},(_,i)=>spawn(s,'unit',i%3===0?'archer':'spearman',0,{x:32+i%6,y:30+Math.floor(i/6)}));}
const points=(units:Entity[])=>units.map(e=>e.order.point!);
const width=(ps:Position[])=>Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x));
const depth=(ps:Position[])=>Math.max(...ps.map(p=>p.y))-Math.min(...ps.map(p=>p.y));
function reject(s:GameState,c:any){const before=structuredClone(s);expect(submit(s,c)).toBeTruthy();expect(s).toEqual(before);}

it('line, box and spread create distinct shapes with unique actual navigation destinations',()=>{
 const spans:Record<string,{width:number;depth:number}>={};
 for(const formation of ['line','box','spread']){
  const s=setup(),units=army(s);
  expect(submit(s,{type:'formation',player:0,ids:units.map(e=>e.id),formation})).toBeNull();
  expect(submit(s,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'move',point:{x:35,y:50}}})).toBeNull();
  const ps=points(units);expect(new Set(ps.map(p=>`${Math.floor(p.x)},${Math.floor(p.y)}`)).size).toBe(units.length);
  spans[formation]={width:width(ps),depth:depth(ps)};
 }
 expect(spans.line.width).toBeGreaterThan(spans.box.width);expect(spans.line.depth).toBeLessThan(spans.box.depth);
 expect(spans.spread.width*spans.spread.depth).toBeGreaterThan(spans.box.width*spans.box.depth);
});
it.each(['move','attackMove','patrol'])('%s places melee in front of archers and is independent of selection order',kind=>{
 const s=setup(),units=army(s),clone=structuredClone(s),ids=units.map(e=>e.id);
 const order={kind,point:{x:35,y:50}};
 expect(submit(s,{type:'order',ids,player:0,order})).toBeNull();
 expect(submit(clone,{type:'order',ids:[...ids].reverse(),player:0,order})).toBeNull();
 expect(points(units)).toEqual(points(ids.map(id=>clone.entities[id])));
 const front=units.filter(e=>e.type==='spearman').map(e=>e.order.point!.y),back=units.filter(e=>e.type==='archer').map(e=>e.order.point!.y);
 expect(Math.min(...front)).toBeGreaterThanOrEqual(Math.max(...back));
 if(kind==='patrol')expect(units[0].order.origin).toEqual({x:32,y:30});
});
it('keeps corner destinations clear of every building footprint, unique and reachable',()=>{
 const s=setup(),units=army(s,30);spawn(s,'building','fortress',0,{x:1,y:1});spawn(s,'building','farm',0,{x:5,y:1});
 expect(submit(s,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'move',point:{x:1,y:1}}})).toBeNull();
 const ps=points(units);expect(new Set(ps.map(p=>`${Math.floor(p.x)},${Math.floor(p.y)}`)).size).toBe(units.length);
 for(const p of ps){expect(p.x).toBeGreaterThanOrEqual(1);expect(p.y).toBeGreaterThanOrEqual(1);expect(p.x).toBeLessThan(95);expect(p.y).toBeLessThan(95);expect(p.x<5&&p.y<5||p.x>=5&&p.x<8&&p.y<4).toBe(false);expect(pathfind(s,units[0],p,0)).not.toHaveLength(0);}
 expect(Math.max(...ps.map(p=>Math.hypot(p.x-1,p.y-1)))).toBeLessThan(20);
});
it('chooses the reachable side of a complete wall instead of leaving soldiers stuck',()=>{
 const s=setup(),units=army(s,6);for(let y=1;y<95;y++)spawn(s,'building','wall',1,{x:45,y});
 expect(submit(s,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'move',point:{x:50,y:35}}})).toBeNull();
 for(const p of points(units))expect(p.x).toBeLessThan(45);
 step(s,400,false);expect(units.every(e=>e.order.kind==='idle')).toBe(true);
});
it('preserves nested worker tasks and paused wall sequences in mixed army selections',()=>{
 const s=setup(),units=army(s,3),w=spawn(s,'unit','villager',0,{x:30,y:32}),tree=spawn(s,'resource','wood',-1,{x:28,y:30});
 const wall=spawn(s,'building','wall',0,{x:29,y:33});wall.progress=.2;wall.hp=1;const next=spawn(s,'building','wall',0,{x:29,y:34});next.progress=.2;next.hp=1;
 submit(s,{type:'order',player:0,ids:[w.id],order:{kind:'gather',target:tree.id}});submit(s,{type:'order',player:0,ids:[w.id],order:{kind:'build',target:wall.id}});w.buildQueue=[next.id];
 const before=structuredClone(w);expect(submit(s,{type:'formation',player:0,ids:[w.id,...units.map(e=>e.id)],formation:'spread'})).toBeNull();expect(w).toEqual(before);
 expect(submit(s,{type:'order',player:0,ids:[w.id,...units.map(e=>e.id)],order:{kind:'move',point:{x:35,y:40}}})).toBeNull();
 expect(w.taskQueue?.map(t=>t.order.target)).toEqual([wall.id,tree.id]);expect(w.taskQueue?.[0].buildQueue).toEqual([next.id]);
 expect(w.order.point).toEqual({x:34.425,y:39.425});
});
it('rejects malformed formations and selections without changing anyone else',()=>{
 const s=setup(),units=army(s,2),enemy=spawn(s,'unit','archer',1,{x:40,y:40});
 for(const formation of ['triangle',null,{},1])reject(s,{type:'formation',player:0,ids:[units[0].id],formation});
 for(const ids of [[],null,[NaN],[units[0].id,...Array(1000).fill(units[0].id)],[enemy.id]])reject(s,{type:'formation',player:0,ids,formation:'box'});
 expect(submit(s,{type:'formation',player:0,ids:[units[0].id,enemy.id],formation:'box'})).toBeNull();expect((enemy as any).formation).toBeUndefined();
});

it('rallies only recruits after the full paid production timer and leaves existing units alone',()=>{
 const s=setup(),b=spawn(s,'building','barracks',0,{x:30,y:35}),existing=army(s,1)[0],before=structuredClone(existing),food=s.players[0].resources.food;
 expect(submit(s,{type:'rally',player:0,building:b.id,point:{x:42,y:40}})).toBeNull();
 expect(submit(s,{type:'recruit',player:0,building:b.id,unit:'spearman'})).toBeNull();
 expect(s.players[0].resources.food).toBe(food-45);updateEconomy(s,11.9,navigationGrids(s));expect(b.queue).toHaveLength(1);expect(s.entities[s.nextId-1].id).toBe(existing.id);
 updateEconomy(s,.11,navigationGrids(s));const fresh=s.entities[s.nextId-1];expect(fresh.type).toBe('spearman');expect(fresh.order).toEqual({kind:'move',point:{x:42,y:40}});expect(existing).toEqual(before);expect(s.players[0].resources.food).toBe(food-45);
});
it.each(['wood','gold','stone','berries','cow','farm'])('assigns a new villager to a valid %s rally source',type=>{
 const s=setup(),b=s.entities[s.players[0].capital],target=spawn(s,type==='farm'?'building':'resource',type as Entity['type'],type==='farm'?0:-1,{x:26,y:25});
 expect(submit(s,{type:'rally',player:0,building:b.id,point:{x:target.x,y:target.y},target:target.id})).toBeNull();
 expect(submit(s,{type:'recruit',player:0,building:b.id,unit:'villager'})).toBeNull();updateEconomy(s,10.01,navigationGrids(s));expect(s.entities[s.nextId-1].order).toMatchObject({kind:'gather',target:target.id});
});
it.each(['dead','depleted','unseen','deleted','enemy farm'])('falls back to the saved world point when a rally source becomes %s',change=>{
 const s=setup(),b=s.entities[s.players[0].capital],target=spawn(s,'building','farm',0,{x:28,y:28});
 submit(s,{type:'rally',player:0,building:b.id,point:{x:28,y:28},target:target.id});submit(s,{type:'recruit',player:0,building:b.id,unit:'villager'});
 if(change==='dead')target.hp=0;if(change==='depleted')target.amount=0;if(change==='unseen'){target.kind='resource';target.type='wood';target.owner=-1;s.visible[0].fill(0);}if(change==='deleted')delete s.entities[target.id];if(change==='enemy farm')target.owner=1;
 updateEconomy(s,10.01,navigationGrids(s));expect(s.entities[s.nextId-1].order).toEqual({kind:'move',point:{x:28,y:28}});
});
it('a military recruit moves toward a resource rally rather than trying to gather',()=>{
 const s=setup(),b=s.entities[s.players[0].capital],target=spawn(s,'resource','wood',-1,{x:26,y:25});
 submit(s,{type:'rally',player:0,building:b.id,point:{x:26,y:25},target:target.id});submit(s,{type:'recruit',player:0,building:b.id,unit:'scout'});updateEconomy(s,14.01,navigationGrids(s));expect(s.entities[s.nextId-1].order).toEqual({kind:'move',point:{x:26,y:25}});
});
it('rejects unowned, unfinished, dead or nonproduction rally buildings atomically',()=>{
 for(const invalid of ['enemy','unfinished','dead','house','unit','missing']){
  const s=setup(),b=spawn(s,invalid==='unit'?'unit':'building',invalid==='unit'?'spearman':invalid==='house'?'house':'barracks',invalid==='enemy'?1:0,{x:30,y:30});
  if(invalid==='unfinished')b.progress=.5;if(invalid==='dead')b.hp=0;
  reject(s,{type:'rally',player:0,building:invalid==='missing'?999999:b.id,point:{x:40,y:40}});
 }
});
it('rejects invalid rally coordinates, hidden resources, enemy farms and nonresource targets',()=>{
 const s=setup(),b=s.entities[s.players[0].capital];
 for(const point of [{x:NaN,y:25},{x:20,y:Infinity},{x:-1,y:25},{x:95,y:25},{x:1000000,y:2}])reject(s,{type:'rally',player:0,building:b.id,point});
 const tree=spawn(s,'resource','wood',-1,{x:50,y:50}),enemyFarm=spawn(s,'building','farm',1,{x:30,y:30});s.visible[0][50*s.size+50]=0;
 for(const target of [tree.id,enemyFarm.id,b.id,NaN,0,999999])reject(s,{type:'rally',player:0,building:b.id,point:{x:40,y:40},target});
});
it('keeps rallies private in live snapshots and explored building memories',()=>{
 const s=setup(),b=s.entities[s.players[0].capital];submit(s,{type:'rally',player:0,building:b.id,point:{x:40,y:40}});updateVisibility(s);s.visible[1].fill(1);
 expect((snapshot(s,0).entities.find(e=>e.id===b.id) as any).rally).toEqual({point:{x:40,y:40}});
 expect((snapshot(s,1).entities.find(e=>e.id===b.id) as any).rally).toBeUndefined();
 s.visible[1].fill(0);s.intel[1][b.id]=structuredClone({...b,ghost:true});expect((snapshot(s,1).entities.find(e=>e.id===b.id) as any).rally).toBeUndefined();
});
it('preserves rally world destination after relocation and clears it on conquest',()=>{
 const s=setup(),b=spawn(s,'building','barracks',0,{x:30,y:30});submit(s,{type:'rally',player:0,building:b.id,point:{x:40,y:40}});
 expect(submit(s,{type:'moveBuilding',player:0,building:b.id,point:{x:35,y:30}})).toBeNull();expect((b as any).rally.point).toEqual({x:40,y:40});
 const cap=s.entities[s.players[0].capital];cap.hp=0;cap.occupation={owner:1,progress:29.99};spawn(s,'unit','spearman',1,{x:19,y:19});updateConquest(s,.05);expect(b.owner).toBe(1);expect((b as any).rally).toBeUndefined();
});
it('round trips formation/rally state and continues old saves with default line formation',()=>{
 const s=setup(),units=army(s,8),b=s.entities[s.players[0].capital];
 expect(decodeSave(encodeSave(s))).toEqual(s);
 submit(s,{type:'formation',player:0,ids:units.map(e=>e.id),formation:'spread'});submit(s,{type:'rally',player:0,building:b.id,point:{x:27,y:25}});submit(s,{type:'recruit',player:0,building:b.id,unit:'villager'});
 const restored=decodeSave(encodeSave(s));expect(restored).toEqual(s);step(s,210,false);step(restored,210,false);expect(restored).toEqual(s);
});
it('rejects damaged optional formation/rally save fields but accepts stale deleted targets',()=>{
 const s=setup(),unit=army(s,1)[0],b=s.entities[s.players[0].capital];
 for(const [entity,key,value] of [[unit,'formation','triangle'],[b,'formation','line'],[unit,'rally',{point:{x:40,y:40}}],[b,'rally',{point:{x:100000,y:40}}],[b,'rally',{point:{x:40,y:40},target:-1}] ] as const){
  const copy=structuredClone(s);(copy.entities[entity.id] as any)[key]=value;expect(()=>decodeSave(encodeSave(copy))).toThrow(/formation|rally/i);
 }
 (b as any).rally={point:{x:40,y:40},target:unit.id};delete s.entities[unit.id];expect(()=>decodeSave(encodeSave(s))).not.toThrow();
});
it('validates both new commands at the network boundary and discards client ownership claims',()=>{
 expect(validateCommand({type:'formation',player:99,ids:[8,8,9],formation:'spread'})).toEqual({type:'formation',player:0,ids:[8,9],formation:'spread'});
 expect(validateMessage({type:'command',seq:7,command:{type:'rally',player:99,building:5,point:{x:20,y:30},target:8}})).toEqual({type:'command',seq:7,command:{type:'rally',player:0,building:5,point:{x:20,y:30},target:8}});
 for(const command of [{type:'formation',ids:[1],formation:'triangle'},{type:'formation',ids:Array(1001).fill(1),formation:'line'},{type:'formation',ids:[NaN],formation:'box'},{type:'rally',building:1,point:{x:NaN,y:20}},{type:'rally',building:1,point:{x:20,y:20},target:0},{type:'rally',building:'1',point:{x:20,y:20}}])expect(()=>validateCommand(command)).toThrow();
});
it('does not disclose a hidden moving rally source through a recruit destination',()=>{
 const s=setup(),b=s.entities[s.players[0].capital],animal=spawn(s,'resource','cow',-1,{x:26,y:25});
 submit(s,{type:'rally',player:0,building:b.id,point:{x:26,y:25},target:animal.id});submit(s,{type:'recruit',player:0,building:b.id,unit:'villager'});
 const copy=structuredClone(s);s.visible[0].fill(0);copy.visible[0].fill(0);animal.x=60;animal.y=50;copy.entities[animal.id].x=70;copy.entities[animal.id].y=80;
 updateEconomy(s,10.01,navigationGrids(s));updateEconomy(copy,10.01,navigationGrids(copy));
 expect(s.entities[s.nextId-1].order).toEqual({kind:'move',point:{x:26,y:25}});expect(copy.entities[copy.nextId-1].order).toEqual(s.entities[s.nextId-1].order);
});
it('retains each separated squad on its reachable side and orients ranks toward eastward travel',()=>{
 const s=setup(),units=army(s,12);for(let y=1;y<95;y++)spawn(s,'building','wall',1,{x:45,y});
 units.slice(6).forEach(e=>e.x=60);
 expect(submit(s,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'attackMove',point:{x:70,y:31}}})).toBeNull();
 expect(points(units.slice(0,6)).every(p=>p.x<45)).toBe(true);expect(points(units.slice(6)).every(p=>p.x>45)).toBe(true);
 const right=units.slice(6),melee=right.filter(e=>e.type==='spearman'),archers=right.filter(e=>e.type==='archer');
 expect(Math.min(...melee.map(e=>e.order.point!.x))).toBeGreaterThan(Math.max(...archers.map(e=>e.order.point!.x)));
});
it('keeps formations private and applies no formation changes to villagers or allied troops',()=>{
 const s=setup(),units=army(s,3),w=spawn(s,'unit','villager',0,{x:30,y:30}),other=spawn(s,'unit','spearman',1,{x:31,y:31});
 expect(submit(s,{type:'formation',player:0,ids:[...units.map(e=>e.id),w.id,other.id],formation:'box'})).toBeNull();
 expect(w.formation).toBeUndefined();expect(other.formation).toBeUndefined();expect(units.every(e=>e.formation==='box')).toBe(true);
 expect(snapshot(s,0).entities.find(e=>e.id===units[0].id)?.formation).toBe('box');expect(snapshot(s,1).entities.find(e=>e.id===units[0].id)?.formation).toBeUndefined();
});
it('rejects malformed offline movement selections before changing existing army orders',()=>{
 const s=setup(),units=army(s,3);
 for(const ids of [[],null,[NaN],Array(1001).fill(units[0].id)])reject(s,{type:'order',player:0,ids,order:{kind:'move',point:{x:40,y:40}}});
 reject(s,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'move',point:{x:NaN,y:40}}});
});
it('clears only an owned completed producer rally without altering paid queue or recruit orders',()=>{
 const s=setup(),b=s.entities[s.players[0].capital];
 submit(s,{type:'rally',player:0,building:b.id,point:{x:30,y:30}});submit(s,{type:'recruit',player:0,building:b.id,unit:'villager'});const queue=structuredClone(b.queue),resources=structuredClone(s.players[0].resources);
 expect(validateCommand({type:'clearRally',player:99,building:b.id})).toEqual({type:'clearRally',player:0,building:b.id});
 expect(submit(s,{type:'clearRally',player:0,building:b.id})).toBeNull();expect(b.rally).toBeUndefined();expect(b.queue).toEqual(queue);expect(s.players[0].resources).toEqual(resources);
 expect(submit(s,{type:'clearRally',player:0,building:b.id})).toBeNull();updateEconomy(s,10.01,navigationGrids(s));expect(s.entities[s.nextId-1].order).toEqual({kind:'idle'});
 for(const invalid of ['enemy','unfinished','dead','house','unit','missing']){
  const state=setup(),entity=spawn(state,invalid==='unit'?'unit':'building',invalid==='unit'?'spearman':invalid==='house'?'house':'barracks',invalid==='enemy'?1:0,{x:30,y:30});if(invalid==='unfinished')entity.progress=.5;if(invalid==='dead')entity.hp=0;
  reject(state,{type:'clearRally',player:0,building:invalid==='missing'?999999:entity.id});
 }
 for(const building of [NaN,0,-1,'1'])expect(()=>validateCommand({type:'clearRally',building})).toThrow();
});
it('plans identical formation slots from identical visible intel despite different hidden fortresses',()=>{
 const s=setup(),units=army(s,12);s.visible[0].fill(0);s.explored[0].fill(0);s.intel[0]={};
 const remembered=spawn(s,'building','fortress',1,{x:60,y:60});s.intel[0][remembered.id]=structuredClone({...remembered,ghost:true});delete s.entities[remembered.id];
 const other=structuredClone(s);spawn(s,'building','fortress',1,{x:64,y:60});spawn(other,'building','fortress',1,{x:60,y:64});
 for(const state of [s,other])expect(submit(state,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'move',point:{x:62,y:62}}})).toBeNull();
 expect(points(units)).toEqual(points(units.map(e=>other.entities[e.id])));
 expect(points(units).every(p=>!(p.x>=60&&p.x<64&&p.y>=60&&p.y<64))).toBe(true);
 expect(snapshot(s,0).entities.filter(e=>e.kind==='building')).toEqual(snapshot(other,0).entities.filter(e=>e.kind==='building'));
});
it('omits private navigation from every snapshot without modifying state, saves or movement',()=>{
 const s=setup(),units=army(s,4);submit(s,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'move',point:{x:40,y:45}}});step(s,2,false);
 expect(units.some(e=>e.path.length>0)).toBe(true);const before=structuredClone(s),restored=decodeSave(encodeSave(s)),start={x:units[0].x,y:units[0].y};
 for(const player of [0,1])for(const entity of snapshot(s,player).entities){expect(entity.path).toEqual([]);expect(entity.pathGoal).toBeUndefined();expect(entity.nextPathTick).toBeUndefined();}
 expect(s).toEqual(before);step(s,40,false);step(restored,40,false);expect(s).toEqual(restored);expect({x:units[0].x,y:units[0].y}).not.toEqual(start);
});
it('keeps authoritative collision when a formation destination was planned before seeing a building',()=>{
 const s=setup(),units=army(s,4),fort=spawn(s,'building','fortress',1,{x:43,y:43});s.visible[0].fill(0);s.intel[0]={};
 expect(submit(s,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'move',point:{x:45,y:45}}})).toBeNull();
 expect(points(units).some(p=>p.x>=fort.x&&p.x<fort.x+4&&p.y>=fort.y&&p.y<fort.y+4)).toBe(true);
 const before=units.map(e=>({x:e.x,y:e.y}));step(s,250,false);const grid=navigationGrids(s)[0];
 expect(units.every(e=>grid[Math.floor(e.y)*s.size+Math.floor(e.x)]===0)).toBe(true);expect(units.some((e,i)=>Math.hypot(e.x-before[i].x,e.y-before[i].y)>5)).toBe(true);
});
it('keeps a 100-unit line within practical ranks while staying wider than a box and selection-order stable',()=>{
 const s=setup(),units=army(s,100),ids=units.map(e=>e.id),reverse=structuredClone(s),box=structuredClone(s),order={kind:'move',point:{x:35,y:65}};
 expect(submit(s,{type:'order',player:0,ids,order})).toBeNull();expect(submit(reverse,{type:'order',player:0,ids:[...ids].reverse(),order})).toBeNull();
 expect(submit(box,{type:'formation',player:0,ids,formation:'box'})).toBeNull();expect(submit(box,{type:'order',player:0,ids,order})).toBeNull();
 const linePoints=points(units);expect(width(linePoints)).toBeLessThan(30);expect(width(linePoints)).toBeGreaterThan(width(points(ids.map(id=>box.entities[id]))));
 expect(new Set(linePoints.map(p=>`${Math.floor(p.x)},${Math.floor(p.y)}`)).size).toBe(100);expect(linePoints).toEqual(points(ids.map(id=>reverse.entities[id])));
 const melee=units.filter(e=>e.type==='spearman'),ranged=units.filter(e=>e.type==='archer');expect(Math.min(...melee.map(e=>e.order.point!.y))).toBeGreaterThan(Math.max(...ranged.map(e=>e.order.point!.y)));
});
