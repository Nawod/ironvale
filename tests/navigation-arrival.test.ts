import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {command,step} from '../src/sim/engine';
import {navigationGrids,pathfind} from '../src/sim/navigation';
import {snapshot} from '../src/sim/visibility';
import type {GameState,Entity} from '../src/sim/types';

function setup(){
 const s=createGame({opponents:1,difficulty:'easy',seed:42});
 for(const e of Object.values(s.entities))if(e.type!=='capital')delete s.entities[e.id];
 s.players.forEach(p=>{p.controller='human';p.resources={food:1000,wood:1000,stone:1000,gold:1000};});s.terrain.fill(0);s.visible.forEach(a=>a.fill(1));s.explored.forEach(a=>a.fill(1));return s;
}
function until(s:GameState,done:()=>boolean,ticks=600){for(let i=0;i<ticks&&!done();i++)step(s,1,false);expect(done()).toBe(true);}
function clear(s:GameState,e:Entity){expect(navigationGrids(s)[e.owner][Math.floor(e.y)*s.size+Math.floor(e.x)]).toBe(0);}

it('finishes a single-unit move at the reachable perimeter of a blocked destination',()=>{
 const s=setup(),unit=spawn(s,'unit','spearman',0,{x:32,y:32});spawn(s,'building','house',0,{x:36,y:31});
 expect(command(s,{type:'order',player:0,ids:[unit.id],order:{kind:'move',point:{x:37,y:32}}})).toBeNull();
 until(s,()=>unit.order.kind==='idle');clear(s,unit);expect(unit.x).toBeGreaterThan(34);
});
it('finishes fog-aware group moves outside a newly discovered building',()=>{
 const s=setup(),units=Array.from({length:4},(_,i)=>spawn(s,'unit','spearman',0,{x:30+i,y:30})),site=spawn(s,'building','fortress',1,{x:40,y:40});site.progress=.5;
 s.visible[0].fill(0);s.intel[0]={};
 expect(command(s,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'move',point:{x:42,y:42}}})).toBeNull();
 expect(units.some(e=>e.order.point!.x>=40&&e.order.point!.x<44&&e.order.point!.y>=40&&e.order.point!.y<44)).toBe(true);
 until(s,()=>units.every(e=>e.order.kind==='idle'));units.forEach(e=>clear(s,e));
});
it('resumes a worker task after temporary movement to a blocked building tile',()=>{
 const s=setup(),worker=spawn(s,'unit','villager',0,{x:32,y:32}),tree=spawn(s,'resource','wood',-1,{x:30,y:32});spawn(s,'building','house',0,{x:36,y:31});
 expect(command(s,{type:'order',player:0,ids:[worker.id],order:{kind:'gather',target:tree.id}})).toBeNull();
 expect(command(s,{type:'order',player:0,ids:[worker.id],order:{kind:'move',point:{x:37,y:32}}})).toBeNull();
 until(s,()=>worker.order.kind==='gather'&&worker.order.target===tree.id);clear(s,worker);expect(worker.taskQueue).toBeUndefined();
});
it('finishes a paid recruit rally at a blocked destination without walking through the building',()=>{
 const s=setup(),b=spawn(s,'building','barracks',0,{x:30,y:30});spawn(s,'building','house',0,{x:40,y:36});
 expect(command(s,{type:'rally',player:0,building:b.id,point:{x:41,y:37}})).toBeNull();
 const id=s.nextId;expect(command(s,{type:'recruit',player:0,building:b.id,unit:'spearman'})).toBeNull();
 until(s,()=>!!s.entities[id]&&s.entities[id].order.kind==='idle');clear(s,s.entities[id]);expect(s.entities[id].x).toBeGreaterThan(37);
});
it('keeps patrolling between the reachable blocked-goal perimeter and its original position',()=>{
 const s=setup(),unit=spawn(s,'unit','spearman',0,{x:32,y:32});spawn(s,'building','house',0,{x:36,y:31});
 expect(command(s,{type:'order',player:0,ids:[unit.id],order:{kind:'patrol',point:{x:37,y:32}}})).toBeNull();
 until(s,()=>unit.order.point?.x===32);expect(unit.order.kind).toBe('patrol');clear(s,unit);expect(unit.x).toBeGreaterThan(34);
 until(s,()=>unit.order.point?.x===37);expect(unit.order.kind).toBe('patrol');clear(s,unit);expect(Math.hypot(unit.x-32.5,unit.y-32.5)).toBeLessThan(.4);
});
it.each([1,4])('walks %i soldiers toward an unseen impassable wall while strict path searches still reject the route',count=>{
 const s=setup(),units=Array.from({length:count},(_,i)=>spawn(s,'unit','spearman',0,{x:30+i,y:30}));
 for(let y=1;y<s.size-1;y++)spawn(s,'building','wall',1,{x:45,y});s.visible[0].fill(0);s.explored[0].fill(0);s.intel[0]={};
 const before=units.map(e=>({x:e.x,y:e.y})),point={x:60,y:35};expect(pathfind(s,units[0],point,0)).toEqual([]);
 expect(command(s,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'move',point}})).toBeNull();
 expect(units.every(e=>e.order.point!.x>45)).toBe(true);expect(units.map(e=>({x:e.x,y:e.y}))).toEqual(before);
 expect(snapshot(s,0).entities.every(e=>e.type!=='wall')).toBe(true);
 step(s,1,false);expect(units.every((e,i)=>Math.hypot(e.x-before[i].x,e.y-before[i].y)<.2)).toBe(true);
 for(const e of snapshot(s,0).entities){expect(e.path).toEqual([]);expect(e.pathGoal).toBeUndefined();}
 until(s,()=>units.every(e=>e.order.kind==='idle'));
 expect(units.every(e=>e.x>42&&e.x<45)).toBe(true);units.forEach(e=>clear(s,e));
 expect(snapshot(s,0).entities.some(e=>e.type==='wall')).toBe(true);expect(pathfind(s,units[0],point,0)).toEqual([]);
});
