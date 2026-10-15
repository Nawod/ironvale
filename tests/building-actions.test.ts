import {it,expect} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {applyCommand,updateEconomy} from '../src/sim/economy';
import {navigationGrids} from '../src/sim/navigation';
import type {BuildingType,Command,GameState,Position} from '../src/sim/types';

function setup(type:BuildingType='house'){
 const s=createGame({opponents:1,difficulty:'easy',seed:42});
 for(const e of Object.values(s.entities))if(e.type!=='capital')delete s.entities[e.id];
 s.visible.forEach(a=>a.fill(1));s.explored.forEach(a=>a.fill(1));
 const b=spawn(s,'building',type,0,{x:30,y:30});
 return{s,b};
}
const destination={x:45,y:30};
function reject(s:GameState,c:Command){const before=structuredClone(s);expect(applyCommand(s,c)).toBeTruthy();expect(s).toEqual(before);}
function economy(s:GameState,ticks=1){for(let i=0;i<ticks;i++){s.tick++;updateEconomy(s,.05,navigationGrids(s));}}

it('moves the existing building without charging, refunding or restoring its damage or farm food',()=>{
 const{s,b}=setup('farm');b.hp=83;b.amount=207;b.visualAge=3;b.lastDamagedTick=1;s.tick=201;
 s.players[0].resources={food:0,wood:0,stone:0,gold:0};const before=structuredClone(b),nextId=s.nextId;
 expect(applyCommand(s,{type:'moveBuilding',player:0,building:b.id,point:destination})).toBeNull();
 expect(s.entities[b.id]).toBe(b);expect(b).toEqual({...before,...destination});expect(s.nextId).toBe(nextId);
 expect(s.players[0].resources).toEqual({food:0,wood:0,stone:0,gold:0});
});
it('preserves reinforced wall upgrades and refreshes navigation at old and new footprints',()=>{
 const{s,b}=setup('wall');b.wallTier=3;b.maxHp=1400;b.hp=600;const old=navigationGrids(s);
 expect(old[0][30*s.size+30]).toBe(1);
 expect(applyCommand(s,{type:'moveBuilding',player:0,building:b.id,point:destination})).toBeNull();
 const next=navigationGrids(s);expect(next).not.toBe(old);expect(next[0][30*s.size+30]).toBe(0);expect(next[0][30*s.size+45]).toBe(1);
 expect([b.wallTier,b.hp,b.maxHp]).toEqual([3,600,1400]);
});
it('allows an overlapping move across its own footprint',()=>{
 const{s,b}=setup();expect(applyCommand(s,{type:'moveBuilding',player:0,building:b.id,point:{x:31,y:30}})).toBeNull();expect(b.x).toBe(31);
});
it.each(['moveBuilding','removeBuilding'] as const)('rejects %s for enemies, allies, units, missing and dead buildings atomically',type=>{
 for(const invalid of ['enemy','ally','unit','missing','dead']){
  const{s,b}=setup();if(invalid==='enemy'||invalid==='ally')b.owner=1;
  if(invalid==='ally')s.players.forEach(p=>p.team=0);
  if(invalid==='unit')b.kind='unit';if(invalid==='dead')b.hp=0;
  reject(s,{type,player:0,building:invalid==='missing'?999999:b.id,point:destination});
 }
});
it.each(['moveBuilding','removeBuilding'] as const)('protects every original capital from %s even after ownership changes',type=>{
 const{s}=setup(),cap=s.entities[s.players[1].capital];cap.owner=0;
 reject(s,{type,player:0,building:cap.id,point:destination});
 // Keep the capture objective protected even if a later representation renames it.
 cap.type='outpost';reject(s,{type,player:0,building:cap.id,point:destination});
});
it.each(['moveBuilding','removeBuilding'] as const)('rejects %s while production/research/upgrade queues or garrisons are occupied',type=>{
 for(const kind of ['unit','age','weapons','armor','wall'] as const){
  const{s,b}=setup();b.queue.push({kind,remaining:10,total:10,cost:{wood:20}});reject(s,{type,player:0,building:b.id,point:destination});
 }
 const{s,b}=setup('tower');b.garrison=[999];reject(s,{type,player:0,building:b.id,point:destination});
});
it('requires completed construction for relocation',()=>{
 const{s,b}=setup();b.progress=.6;reject(s,{type:'moveBuilding',player:0,building:b.id,point:destination});
});
it.each(['moveBuilding','removeBuilding'] as const)('requires a full ten seconds since damage before %s',type=>{
 const{s,b}=setup();s.tick=500;b.lastDamagedTick=301;reject(s,{type,player:0,building:b.id,point:destination});
 s.tick=501;expect(applyCommand(s,{type,player:0,building:b.id,point:destination})).toBeNull();
});
it.each(['moveBuilding','removeBuilding'] as const)('rejects %s near visible hostiles at the source',type=>{
 const{s,b}=setup();spawn(s,'unit','swordsman',1,{x:38,y:30});reject(s,{type,player:0,building:b.id,point:destination});
});
it('rejects relocation near visible hostiles at the destination',()=>{
 const{s,b}=setup();spawn(s,'unit','archer',1,{x:52,y:30});reject(s,{type:'moveBuilding',player:0,building:b.id,point:destination});
});
it('does not let hidden hostiles or allies block a clear relocation',()=>{
 const{s,b}=setup();const enemy=spawn(s,'unit','swordsman',1,{x:38,y:30});s.visible[0][30*s.size+38]=0;
 expect(applyCommand(s,{type:'moveBuilding',player:0,building:b.id,point:destination})).toBeNull();
 b.x=30;b.y=30;s.visible[0][30*s.size+38]=1;s.players.forEach(p=>p.team=0);
 expect(applyCommand(s,{type:'moveBuilding',player:0,building:b.id,point:destination})).toBeNull();expect(enemy.hp).toBeGreaterThan(0);
});
it('rejects exploration without current visibility and checks the entire footprint',()=>{
 const{s,b}=setup();s.visible[0][31*s.size+46]=0;expect(s.explored[0][31*s.size+46]).toBe(1);
 reject(s,{type:'moveBuilding',player:0,building:b.id,point:destination});
});
it.each([{x:-1,y:30},{x:94,y:30},{x:45,y:94},{x:45.1,y:30},{x:NaN,y:30},{x:45,y:Infinity}])('rejects invalid destination %j atomically',(point:Position)=>{
 const{s,b}=setup();reject(s,{type:'moveBuilding',player:0,building:b.id,point});
});
it.each(['building','resource','unit'] as const)('rejects destination collision with a %s',kind=>{
 const{s,b}=setup();spawn(s,kind,kind==='building'?'farm':kind==='resource'?'wood':'villager',kind==='resource'?-1:0,{x:46,y:31});
 reject(s,{type:'moveBuilding',player:0,building:b.id,point:destination});
});
it('allows depleted resources and garrisoned units at the destination',()=>{
 const{s,b}=setup();spawn(s,'resource','wood',-1,destination).amount=0;
 spawn(s,'unit','archer',0,destination).garrisoned=s.players[0].capital;
 expect(applyCommand(s,{type:'moveBuilding',player:0,building:b.id,point:destination})).toBeNull();
});
it.each([0,.5,1])('removes an owned construction at progress %s without a refund',progress=>{
 const{s,b}=setup();b.progress=progress;b.hp=1;const resources=structuredClone(s.players[0].resources),nextId=s.nextId;
 expect(applyCommand(s,{type:'removeBuilding',player:0,building:b.id})).toBeNull();expect(s.entities[b.id]).toBeUndefined();
 expect(s.players[0].resources).toEqual(resources);expect(s.nextId).toBe(nextId);
});
it('resumes a workers saved gather task after removing its active construction without clearing its tasks',()=>{
 const{s,b}=setup(),w=spawn(s,'unit','villager',0,{x:28,y:30}),tree=spawn(s,'resource','wood',-1,{x:27,y:30});b.progress=.5;
 expect(applyCommand(s,{type:'order',player:0,ids:[w.id],order:{kind:'gather',target:tree.id}})).toBeNull();
 expect(applyCommand(s,{type:'order',player:0,ids:[w.id],order:{kind:'build',target:b.id}})).toBeNull();
 const tasks=structuredClone(w.taskQueue);expect(applyCommand(s,{type:'removeBuilding',player:0,building:b.id})).toBeNull();expect(w.taskQueue).toEqual(tasks);
 economy(s,2);expect(w.order).toMatchObject({kind:'gather',target:tree.id});
});
it('skips a removed wall in an active sequence and resumes gathering when the remaining neighbors finish',()=>{
 const{s,b}=setup('wall'),w=spawn(s,'unit','villager',0,{x:28,y:30}),tree=spawn(s,'resource','wood',-1,{x:27,y:30});b.progress=.5;
 const removed=spawn(s,'building','wall',0,{x:31,y:30}),last=spawn(s,'building','wall',0,{x:32,y:30});removed.progress=last.progress=.99;
 applyCommand(s,{type:'order',player:0,ids:[w.id],order:{kind:'gather',target:tree.id}});
 applyCommand(s,{type:'order',player:0,ids:[w.id],order:{kind:'build',target:b.id}});w.buildQueue=[removed.id,last.id];
 expect(applyCommand(s,{type:'removeBuilding',player:0,building:removed.id})).toBeNull();expect(w.buildQueue).toEqual([removed.id,last.id]);
 expect(applyCommand(s,{type:'removeBuilding',player:0,building:b.id})).toBeNull();economy(s);expect(w.order).toMatchObject({kind:'build',target:last.id});
 economy(s,100);expect(last.progress).toBe(1);expect(w.order).toMatchObject({kind:'gather',target:tree.id});
});
it('preserves a paused wall sequence when its first saved site is removed',()=>{
 const{s,b}=setup('wall'),w=spawn(s,'unit','villager',0,{x:28.5,y:31}),tree=spawn(s,'resource','wood',-1,{x:27,y:31});b.progress=.99;
 const next=spawn(s,'building','wall',0,{x:31,y:30}),house=spawn(s,'building','house',0,{x:30,y:34});next.progress=house.progress=.99;
 applyCommand(s,{type:'order',player:0,ids:[w.id],order:{kind:'gather',target:tree.id}});
 applyCommand(s,{type:'order',player:0,ids:[w.id],order:{kind:'build',target:b.id}});w.buildQueue=[next.id];
 applyCommand(s,{type:'order',player:0,ids:[w.id],order:{kind:'build',target:house.id}});
 const tasks=structuredClone(w.taskQueue);expect(applyCommand(s,{type:'removeBuilding',player:0,building:b.id})).toBeNull();expect(w.taskQueue).toEqual(tasks);
 economy(s,300);expect(house.progress).toBe(1);expect(next.progress).toBe(1);expect(w.order).toMatchObject({kind:'gather',target:tree.id});
});
it('keeps a farmers target ID and redirects travel to the relocated farm',()=>{
 const{s,b}=setup('farm'),w=spawn(s,'unit','villager',0,{x:28.5,y:31});
 applyCommand(s,{type:'order',player:0,ids:[w.id],order:{kind:'gather',target:b.id}});
 expect(applyCommand(s,{type:'moveBuilding',player:0,building:b.id,point:destination})).toBeNull();economy(s);
 expect(w.order).toMatchObject({kind:'gather',target:b.id});expect(w.pathGoal?.x).toBeGreaterThanOrEqual(destination.x);
});
