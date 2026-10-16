import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {summarizeWorkforce} from '../src/ui/workforce';
it('groups only living owned workers by their current job, including berries, farms and return trips',()=>{
 const s=createGame({opponents:1,difficulty:'easy',seed:42}),entities=Object.values(s.entities).filter(e=>e.kind==='resource');
 const berry=spawn(s,'resource','berries',-1,{x:30,y:30}),farm=spawn(s,'building','farm',0,{x:33,y:30}),tree=entities.find(e=>e.type==='wood')!;
 const worker=(kind:'gather'|'build'|'repair'|'move'|'idle',target?:number)=>{const w=spawn(s,'unit','villager',0,{x:20,y:20});w.order={kind,target};return w;};
 const food=worker('gather',berry.id),farmer=worker('gather',farm.id),wood=worker('gather',tree.id),delivery=worker('gather',999999);delivery.carry={resource:'gold',amount:15};delivery.order.returning=true;
 const build=worker('build',s.players[0].capital),repair=worker('repair',s.players[0].capital),moving=worker('move'),idle=worker('idle'),pending=worker('idle');pending.taskQueue=[{order:{kind:'gather',target:tree.id}}];
 const hidden=worker('idle');hidden.ghost=true;const dead=worker('idle');dead.hp=0;const garrison=worker('idle');garrison.garrisoned=1;const enemy=worker('idle');enemy.owner=1;
 const source=[...entities,berry,farm,food,farmer,wood,delivery,build,repair,moving,idle,pending,hidden,dead,garrison,enemy,wood],r=summarizeWorkforce(source,0);
 expect(r.total).toBe(9);expect(r.groups.food).toEqual([food.id,farmer.id]);expect(r.groups.wood).toEqual([wood.id]);expect(r.groups.gold).toEqual([delivery.id]);expect(r.groups.building).toEqual([build.id]);expect(r.groups.repairing).toEqual([repair.id]);expect(r.groups.idle).toEqual([idle.id]);expect(r.groups.other).toEqual([moving.id,pending.id]);expect(Object.values(r.groups).flat()).toHaveLength(r.total);
});
it('counts carried idle deliveries as work and never infers a missing target resource from the hidden world',()=>{
 const s=createGame({opponents:1,difficulty:'easy',seed:42}),w=spawn(s,'unit','villager',0,{x:20,y:20});w.carry={resource:'stone',amount:4};
 expect(summarizeWorkforce([w],0).groups.stone).toEqual([w.id]);w.order={kind:'gather',target:123456};w.carry=undefined;expect(summarizeWorkforce([w],0).groups.other).toEqual([w.id]);expect(summarizeWorkforce([w],1).total).toBe(0);
});
