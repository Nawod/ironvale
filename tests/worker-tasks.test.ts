import {it,expect} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {command,step} from '../src/sim/engine';
import {decodeSave,encodeSave} from '../src/sim/save';
import {snapshot,updateVisibility} from '../src/sim/visibility';
import {updateConquest} from '../src/sim/combat';
import type {Entity,GameState,Order} from '../src/sim/types';

function setup(){
 const s=createGame({opponents:1,difficulty:'easy',seed:42});
 for(const e of Object.values(s.entities))if(e.type!=='capital')delete s.entities[e.id];
 s.terrain.fill(0);s.players.forEach(p=>{p.controller='human';p.resources={food:1000,wood:1000,stone:1000,gold:1000};});
 const w=spawn(s,'unit','villager',0,{x:17,y:22}),tree=spawn(s,'resource','wood',-1,{x:15,y:22});tree.amount=400;
 s.visible.forEach(a=>a.fill(1));s.explored.forEach(a=>a.fill(1));return{s,w,tree};
}
function order(s:GameState,w:Entity,o:Order){expect(command(s,{type:'order',ids:[w.id],player:w.owner,order:o})).toBeNull();}
function site(s:GameState,x:number,y:number){const b=spawn(s,'building','house',0,{x,y});b.progress=0;b.hp=1;return b;}
function until(s:GameState,done:()=>boolean,ticks=2400){for(let i=0;i<ticks&&!done();i++)step(s,1,false);expect(done()).toBe(true);}

it('finishes nested construction in newest-first order, then returns to gathering',()=>{
 const{s,w,tree}=setup(),a=site(s,22,22),b=site(s,22,25);
 order(s,w,{kind:'gather',target:tree.id});order(s,w,{kind:'build',target:a.id});order(s,w,{kind:'build',target:b.id});
 expect(w.taskQueue?.map(t=>t.order.target)).toEqual([a.id,tree.id]);
 until(s,()=>b.progress===1);expect(a.progress).toBe(0);
 until(s,()=>a.progress===1&&w.order.kind==='gather');expect(w.order.target).toBe(tree.id);expect(w.taskQueue?.length??0).toBe(0);
});
it('resumes repairs after a temporary move, then resumes the earlier resource task',()=>{
 const{s,w,tree}=setup(),b=spawn(s,'building','storage',0,{x:22,y:22});b.hp-=9;
 order(s,w,{kind:'gather',target:tree.id});order(s,w,{kind:'repair',target:b.id});order(s,w,{kind:'move',point:{x:19,y:25}});
 until(s,()=>b.hp===b.maxHp&&w.order.kind==='gather');expect(w.order.target).toBe(tree.id);
});
it('finishes the newly assigned food source and delivers its carry before returning to wood',()=>{
 const{s,w,tree}=setup(),b=spawn(s,'resource','berries',-1,{x:17,y:23});b.amount=.5;
 order(s,w,{kind:'gather',target:tree.id});order(s,w,{kind:'gather',target:b.id});
 until(s,()=>w.order.target===tree.id&&w.order.kind==='gather');expect(s.players[0].resources.food).toBeCloseTo(1000.5);expect(b.amount).toBe(0);
});
it('skips destroyed, completed and no-longer-owned tasks without getting stuck',()=>{
 const{s,w,tree}=setup(),a=site(s,22,22),b=site(s,22,25),c=site(s,25,22);
 order(s,w,{kind:'gather',target:tree.id});for(const target of [a,b,c])order(s,w,{kind:'build',target:target.id});order(s,w,{kind:'move',point:{x:18,y:24}});
 delete s.entities[a.id];b.progress=1;c.owner=1;
 until(s,()=>w.order.kind==='gather'&&w.order.target===tree.id);expect(w.taskQueue?.length??0).toBe(0);
});
it('Stop clears interrupted tasks and paused wall plans permanently',()=>{
 const{s,w,tree}=setup();order(s,w,{kind:'gather',target:tree.id});order(s,w,{kind:'move',point:{x:25,y:25}});
 expect(w.taskQueue).toHaveLength(1);w.buildQueue=[999];order(s,w,{kind:'idle'});step(s,100,false);
 expect(w.order.kind).toBe('idle');expect(w.taskQueue).toBeUndefined();expect(w.buildQueue).toBeUndefined();
});
it('saves and restores an interrupted wall sequence and the job before it',()=>{
 const{s,w,tree}=setup();s.players[0].age=2;order(s,w,{kind:'gather',target:tree.id});
 const walls:number[]=[];for(const x of [22,23,24]){expect(command(s,{type:'build',player:0,workers:[w.id],building:'wall',point:{x,y:24}})).toBeNull();walls.push(s.nextId-1);}
 order(s,w,{kind:'move',point:{x:20,y:26}});expect(w.taskQueue?.[0].buildQueue).toEqual(walls.slice(1));
 const restored=decodeSave(encodeSave(s));until(s,()=>walls.every(id=>s.entities[id].progress===1)&&w.order.kind==='gather');
 step(restored,s.tick,false);expect(restored).toEqual(s);expect(w.order.target).toBe(tree.id);expect(s.players[0].resources.stone).toBe(964);
});
it('each worker in a group resumes its own interrupted assignment',()=>{
 const{s,w,tree}=setup(),other=spawn(s,'unit','villager',0,{x:18,y:22}),food=spawn(s,'resource','berries',-1,{x:15,y:24}),b=site(s,22,22);
 order(s,w,{kind:'gather',target:tree.id});order(s,other,{kind:'gather',target:food.id});
 expect(command(s,{type:'order',player:0,ids:[w.id,other.id],order:{kind:'build',target:b.id}})).toBeNull();
 until(s,()=>b.progress===1&&w.order.kind==='gather'&&other.order.kind==='gather');expect(w.order.target).toBe(tree.id);expect(other.order.target).toBe(food.id);
});
it('keeps worker plans private and rejects malformed saved task lists',()=>{
 const{s,w,tree}=setup();order(s,w,{kind:'gather',target:tree.id});order(s,w,{kind:'move',point:{x:25,y:25}});s.visible[1].fill(1);
 expect(snapshot(s,0).entities.find(e=>e.id===w.id)?.taskQueue).toHaveLength(1);expect(snapshot(s,1).entities.find(e=>e.id===w.id)?.taskQueue).toBeUndefined();
 for(const bad of ['broken',[{order:{kind:'build',target:'bad'}}],[{order:{kind:'move',point:{x:-1,y:20}}}],[{order:{kind:'gather',target:tree.id},buildQueue:[-1]}]]){
  const damaged=structuredClone(s);(damaged.entities[w.id] as any).taskQueue=bad;expect(()=>decodeSave(encodeSave(damaged))).toThrow(/task/i);
 }
});
it('clears the old owner task list when a worker is conquered',()=>{
 const{s,w,tree}=setup();order(s,w,{kind:'gather',target:tree.id});order(s,w,{kind:'move',point:{x:24,y:24}});
 const cap=s.entities[s.players[0].capital];cap.hp=0;cap.occupation={owner:1,progress:29.99};spawn(s,'unit','swordsman',1,{x:19,y:19});updateConquest(s,.05);
 expect(w.owner).toBe(1);expect(w.taskQueue).toBeUndefined();expect(w.order.kind).toBe('idle');
});
it('returns to a remembered resource location after a temporary task takes it into fog',()=>{
 const{s,w,tree}=setup();tree.x=40;tree.y=30;w.x=40;w.y=31;updateVisibility(s);
 order(s,w,{kind:'gather',target:tree.id});order(s,w,{kind:'move',point:{x:60,y:60}});
 until(s,()=>w.order.kind==='gather'&&w.order.target===tree.id);
 expect(Math.hypot(w.x-tree.x,w.y-tree.y)).toBeLessThan(9);
});
it('rejects a full task list before spending construction resources and deduplicates repeated jobs',()=>{
 const{s,w,tree}=setup();order(s,w,{kind:'gather',target:tree.id});
 for(let i=0;i<128;i++)order(s,w,{kind:'move',point:{x:30+i%20,y:30+Math.floor(i/20)}});
 expect(w.taskQueue).toHaveLength(128);const before=encodeSave(s);
 expect(command(s,{type:'build',player:0,workers:[w.id],building:'house',point:{x:22,y:22}})).toMatch(/task list is full/i);expect(encodeSave(s)).toBe(before);
 order(s,w,{kind:'gather',target:tree.id});expect(w.taskQueue).toHaveLength(128);
 for(let i=0;i<5;i++)order(s,w,{kind:'gather',target:tree.id});expect(w.taskQueue).toHaveLength(128);
});
it('returns to interrupted work after constructing a farm, before taking automatic farm work',()=>{
 const{s,w,tree}=setup(),farm=spawn(s,'building','farm',0,{x:22,y:22});farm.progress=0;farm.hp=1;
 order(s,w,{kind:'gather',target:tree.id});order(s,w,{kind:'build',target:farm.id});
 until(s,()=>farm.progress===1&&w.order.kind==='gather');expect(w.order.target).toBe(tree.id);
});
it('promotes a paused wall task together with its remaining wall sequence',()=>{
 const{s,w,tree}=setup();s.players[0].age=2;order(s,w,{kind:'gather',target:tree.id});const walls:number[]=[];
 for(const x of [22,23,24]){expect(command(s,{type:'build',player:0,workers:[w.id],building:'wall',point:{x,y:24}})).toBeNull();walls.push(s.nextId-1);}
 const house=site(s,25,22);order(s,w,{kind:'build',target:house.id});order(s,w,{kind:'build',target:walls[0]});
 expect(w.buildQueue).toEqual(walls.slice(1));expect(w.taskQueue?.map(t=>t.order.target)).toEqual([house.id,tree.id]);
 until(s,()=>walls.every(id=>s.entities[id].progress===1)&&house.progress===1&&w.order.kind==='gather');
});
it('can resume a paused storehouse build when exhausted food cannot be deposited anywhere',()=>{
 const{s,w,tree}=setup(),store=spawn(s,'building','storage',0,{x:22,y:22}),food=spawn(s,'resource','berries',-1,{x:17,y:23});
 store.progress=0;store.hp=1;food.amount=.5;s.entities[s.players[0].capital].hp=0;
 order(s,w,{kind:'gather',target:tree.id});order(s,w,{kind:'build',target:store.id});order(s,w,{kind:'gather',target:food.id});
 until(s,()=>store.progress===1&&w.order.kind==='gather'&&w.order.target===tree.id&&s.players[0].resources.food>1000);
 expect(s.players[0].resources.food).toBeCloseTo(1000.5);
});
it('preserves unfinished gathering while temporarily finishing a remembered drop-off building',()=>{
 const{s,w,tree}=setup(),store=spawn(s,'building','storage',0,{x:22,y:22});store.progress=0;store.hp=1;s.entities[s.players[0].capital].hp=0;
 order(s,w,{kind:'build',target:store.id});order(s,w,{kind:'gather',target:tree.id});w.carry={resource:'wood',amount:15};
 until(s,()=>store.progress===1&&w.order.kind==='gather'&&w.order.target===tree.id&&s.players[0].resources.wood>1000);
});
it('returns to work after a temporary attack finishes',()=>{
 const{s,w,tree}=setup(),enemy=spawn(s,'unit','villager',1,{x:17.2,y:22});enemy.hp=1;
 order(s,w,{kind:'gather',target:tree.id});order(s,w,{kind:'attack',target:enemy.id});
 until(s,()=>!s.entities[enemy.id]&&w.order.kind==='gather'&&w.order.target===tree.id);
});
