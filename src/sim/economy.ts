import type { Command, Entity, GameState, Position, Resources, Resource, UnitType } from './types';
import { BUILDINGS, UNITS, AGE_COSTS, wallUpgrade } from './definitions';
import { capacity, population, seen } from './visibility';
import { adjacentDistance, approach, bounds, canPlace, travel } from './navigation';
import { spawn } from './world';
import {hostile} from './teams';
import {FOOD_SOURCES,harvestedResource} from './nature';
import type {FoodSourceType} from './types';
import {assign,assignTask,canAssignTask,pendingTaskCount,resumeWorkerTask,resumeWithoutStore,MAX_WORKER_TASKS} from './tasks';
export {assign} from './tasks';
export function event(s:GameState,player:number,text:string,kind:'info'|'attack'|'capture'|'error'|'complete'='info',p?:Position):void {s.events.push({id:s.nextEvent++,tick:s.tick,player,text,kind,...(p?{x:p.x,y:p.y}:{})});if(s.events.length>80)s.events.splice(0,s.events.length-80);}
export function affordable(s:GameState,player:number,cost:Partial<Resources>):boolean {return Object.entries(cost).every(([r,n])=>s.players[player].resources[r as Resource]>=n!);}
export function pay(s:GameState,player:number,cost:Partial<Resources>):boolean {if(!affordable(s,player,cost))return false;for(const[r,n]of Object.entries(cost))s.players[player].resources[r as Resource]-=n!;return true;}
export function applyCommand(s:GameState,c:Command):string|null {
 const p=s.players[c.player];if(!p?.alive||s.winner!==null)return 'This empire is no longer in the match.';
 const owned=(id:number)=>{const e=s.entities[id];return e?.owner===c.player?e:undefined;};
 if(c.type==='build'){
  const d=BUILDINGS[c.building];if(!d||c.building==='capital'||c.building==='outpost')return 'Use your original town center.';
  if(p.age<d.age)return 'Advance your empire to unlock this building.';
  const point={x:Math.floor(c.point.x),y:Math.floor(c.point.y)};
  const workers=[...new Set(c.workers)].map(owned).filter((e):e is Entity=>!!e&&e.type==='villager'&&!e.garrisoned);
  if(!workers.length)return 'Select a villager to build.';
  if(!canPlace(s,c.building,point))return 'Choose clear land for this building.';
  for(let y=point.y;y<point.y+d.size;y++)for(let x=point.x;x<point.x+d.size;x++)if(!s.visible[c.player][y*s.size+x])return 'Scout this land before building.';
  const continuesWalls=(w:Entity)=>c.building==='wall'&&w.order.kind==='build'&&(s.entities[w.order.target??0]?.type==='wall'&&s.entities[w.order.target??0]?.owner===w.owner||(w.buildQueue??[]).some(id=>s.entities[id]?.owner===w.owner));
  if(workers.some(w=>continuesWalls(w)?pendingTaskCount(w)>=MAX_WORKER_TASKS:!canAssignTask(w,{kind:'build',target:s.nextId})))return 'Worker task list is full. Finish tasks or use Stop to clear it.';
  if(!pay(s,c.player,d.cost))return 'Not enough resources.';
  const e=spawn(s,'building',c.building,c.player,point);e.progress=0;e.hp=1;for(const w of workers){if(continuesWalls(w)){(w.buildQueue??=[]).push(e.id);}else assignTask(s,w,{kind:'build',target:e.id});}return null;
 }
 if(c.type==='upgradeWall'){
  const b=owned(c.building),d=b&&wallUpgrade(b);
  if(!b||!d||b.progress!==1||b.hp<=0)return 'Select a completed wall you own that can be upgraded.';
  if(p.age<d.age)return 'Advance your town hall age to unlock this wall upgrade.';
  if(b.queue.length)return 'A wall upgrade is already underway.';
  if(!pay(s,p.id,d.cost))return 'Not enough resources.';
  b.queue.push({kind:'wall',remaining:d.seconds,total:d.seconds,cost:d.cost});return null;
 }
 if(c.type==='recruit'){
  const b=owned(c.building),d=UNITS[c.unit];if(!b||b.kind!=='building'||b.progress<1||b.hp<=0)return 'Select a completed building you own.';
  if(!d||!BUILDINGS[b.type as keyof typeof BUILDINGS].trains?.includes(c.unit)||p.age<d.age)return 'This troop is not available here yet.';
  const queued=Object.values(s.entities).filter(e=>e.owner===c.player).reduce((n,e)=>n+e.queue.filter(q=>q.kind==='unit').length,0);
  if(population(s,c.player)+queued>=capacity(s,c.player))return 'Build houses for more population.';
  if(b.queue.length>=8)return 'The production queue is full.';
  if(!pay(s,c.player,d.cost))return 'Not enough resources.';
  b.queue.push({kind:'unit',unit:c.unit,remaining:d.seconds,total:d.seconds,cost:d.cost});return null;
 }
 if(c.type==='research'){
  const b=owned(c.building);if(!b||b.kind!=='building'||b.progress<1||b.hp<=0)return 'Select a completed research building.';
  if(c.research==='age'){
   if(b.id!==p.capital||p.age===3)return 'Advance at your original town center.';
   const required=p.age===1?['barracks','storage']:['smithy','market'];
   if(!required.every(t=>Object.values(s.entities).some(e=>e.owner===p.id&&e.type===t&&e.progress===1)))return `Build ${required.join(' and ')} first.`;
  }else if(b.type!=='smithy'||p[c.research]>=p.age-1)return 'This upgrade is not available.';
  if(Object.values(s.entities).some(e=>e.owner===p.id&&e.queue.some(q=>q.kind===c.research)))return 'That research is already underway.';
  const cost=c.research==='age'?AGE_COSTS[p.age]:{food:100*(p[c.research]+1),gold:80*(p[c.research]+1)};
  if(!pay(s,p.id,cost))return 'Not enough resources.';
  const seconds=c.research==='age'?45:30;b.queue.push({kind:c.research,remaining:seconds,total:seconds,cost});return null;
 }
 if(c.type==='trade'){
  if(!['food','wood','stone','gold'].includes(c.sell)||!['food','wood','stone','gold'].includes(c.buy)||c.sell===c.buy)return 'Choose two different resources.';
  if(!Object.values(s.entities).some(e=>e.owner===p.id&&e.type==='market'&&e.progress===1&&e.hp>0))return 'Build a market to exchange resources.';
  if(!pay(s,p.id,{[c.sell]:100}))return 'You need 100 resources to exchange.';p.resources[c.buy]+=65;return null;
 }
 if(c.type==='rebuild'){
  const cap=s.entities[p.capital],workers=[...new Set(c.workers)].map(owned).filter((e):e is Entity=>!!e&&e.type==='villager');
  if(!cap||cap.hp>0||!workers.length)return 'Select villagers to rebuild your fallen capital.';
  if(Object.values(s.entities).some(e=>e.kind==='unit'&&hostile(s,p.id,e.owner)&&e.type!=='villager'&&Math.hypot(e.x-cap.x,e.y-cap.y)<6))return 'Clear enemy soldiers from your capital first.';
  if(workers.some(w=>!canAssignTask(w,{kind:'build',target:cap.id})))return 'Worker task list is full. Finish tasks or use Stop to clear it.';
  if(!pay(s,p.id,BUILDINGS.capital.cost))return 'Not enough resources to rebuild.';
  cap.hp=1;cap.progress=0;cap.occupation=undefined;for(const w of workers)assignTask(s,w,{kind:'build',target:cap.id});return null;
 }
 if(c.type==='ungarrison'){
  const b=owned(c.building);if(!b)return 'Select your own building.';for(const id of b.garrison){const e=s.entities[id];if(e){e.garrisoned=undefined;e.x=b.x-1;e.y=b.y+1;assign(e,{kind:'idle'});}}b.garrison=[];return null;
 }
 if(c.type==='stance'){for(const id of c.ids){const e=owned(id);if(e?.kind==='unit'){e.stance=c.stance;e.home={x:e.x,y:e.y};}}return null;}
 if(c.type==='order'){
  if(!['idle','move','gather','build','repair','attack','attackMove','patrol','garrison'].includes(c.order.kind))return 'Unknown order.';
  const units=[...new Set(c.ids)].map(owned).filter((e):e is Entity=>!!e&&e.kind==='unit'&&!e.garrisoned);if(!units.length)return 'Select units you own.';
  if(c.order.point&&!bounds(s,c.order.point))return 'That location is outside the map.';
  if(['move','attackMove','patrol'].includes(c.order.kind)&&!c.order.point)return 'Choose a destination.';
  const target=c.order.target===undefined?undefined:s.entities[c.order.target];
  if(['attack','gather','build','repair','garrison'].includes(c.order.kind)&&!target)return 'That target is no longer available.';
  if(target&&!seen(s,p.id,target))return 'Your units cannot see that target.';
  if(c.order.kind==='attack'&&(!target||!hostile(s,p.id,target.owner)||target.hp<=0))return 'Choose a living enemy target.';
  if(c.order.kind==='gather'&&(!target||target.kind!=='resource'&&!(target.type==='farm'&&target.owner===p.id&&target.progress===1)))return 'Choose a resource or your completed farm.';
  if(['build','repair','garrison'].includes(c.order.kind)&&target?.owner!==p.id)return 'Choose your own building.';
  if(['build','repair'].includes(c.order.kind)&&target?.kind!=='building')return 'Choose your own building.';
  if(c.order.kind==='build'&&target!.progress>=1)return 'That building is already complete. Use repair for damage.';
  if(c.order.kind==='repair'&&target!.progress<1)return 'Finish construction before repairing this building.';
  if(c.order.kind==='garrison'&&(!target||!BUILDINGS[target.type as keyof typeof BUILDINGS]?.slots||target.progress<1))return 'Garrison in a completed tower or fortress.';
  if(c.order.kind==='repair'&&target?.hp===0)return 'Use rebuild to restore your capital.';
  const columns=Math.ceil(Math.sqrt(units.length)),assignments=units.flatMap((e,index)=>{
   if(['gather','build','repair'].includes(c.order.kind)&&e.type!=='villager'||c.order.kind==='garrison'&&e.type==='villager')return [];
   const point=c.order.point&&units.length>1?{x:Math.max(1,Math.min(s.size-2,c.order.point.x+(index%columns-(columns-1)/2)*1.15)),y:Math.max(1,Math.min(s.size-2,c.order.point.y+(Math.floor(index/columns)-(Math.ceil(units.length/columns)-1)/2)*1.15))}:c.order.point;
   return [{e,order:{...c.order,point,origin:c.order.kind==='patrol'?{x:e.x,y:e.y}:undefined}}];
  });
  if(!assignments.length)return 'These units cannot perform that task.';
  if(assignments.some(({e,order})=>!canAssignTask(e,order)))return 'Worker task list is full. Finish tasks or use Stop to clear it.';
  for(const {e,order}of assignments)assignTask(s,e,order);return null;
 }return 'Unknown command.';
}
function nextConstruction(s:GameState,w:Entity):void{
 const queue=w.buildQueue??[];let id:number|undefined;while(queue.length){const candidate=queue.shift()!,site=s.entities[candidate];if(site?.owner===w.owner&&site.kind==='building'&&site.hp>0&&site.progress<1){id=candidate;break;}}
 assign(w,id?{kind:'build',target:id}:{kind:'idle'});if(id&&queue.length)w.buildQueue=queue;
}
function dropoff(s:GameState,w:Entity,dt:number,grid:Uint8Array):boolean {
 const stores=Object.values(s.entities).filter(e=>e.owner===w.owner&&e.kind==='building'&&['capital','storage','outpost'].includes(e.type)&&e.hp>0&&e.progress===1).sort((a,b)=>adjacentDistance(w,a)-adjacentDistance(w,b));
 const b=stores[0];if(!b){resumeWithoutStore(s,w);return false;}
 if(adjacentDistance(w,b)<1.6){if(w.carry){s.players[w.owner].resources[w.carry.resource]+=w.carry.amount;w.carry=undefined;}w.order.returning=false;w.path=[];w.pathGoal=undefined;return true;}
 travel(s,w,approach(s,w,b,grid),dt,grid);return false;
}
export function updateEconomy(s:GameState,dt:number,grids:Uint8Array[]):void{
 for(const e of Object.values(s.entities)){
  if(e.kind==='building'&&e.hp>0&&e.progress===1&&e.queue.length){const q=e.queue[0];if(q.kind==='unit'&&population(s,e.owner)>=capacity(s,e.owner))continue;q.remaining-=dt;if(q.remaining>0)continue;
   if(q.kind==='unit'){const grid=grids[e.owner];let point:Position|undefined;const n=BUILDINGS[e.type as keyof typeof BUILDINGS].size;for(let r=1;r<=5&&!point;r++){const exits:Position[]=[];for(let dx=-r;dx<=n+r;dx++)for(let dy=-r;dy<=n+r;dy++){if(dx!==-r&&dx!==n+r&&dy!==-r&&dy!==n+r)continue;const x=Math.floor(e.x+dx),y=Math.floor(e.y+dy);if(bounds(s,{x,y})&&!grid[y*s.size+x]&&!Object.values(s.entities).some(v=>(v.kind==='unit'&&!v.garrisoned||v.kind==='resource'&&v.amount>0)&&Math.floor(v.x)===x&&Math.floor(v.y)===y))exits.push({x:x+.5,y:y+.5});}exits.sort((a,b)=>(b.x+b.y)-(a.x+a.y)||Math.abs((a.x-e.x)-(a.y-e.y))-Math.abs((b.x-e.x)-(b.y-e.y)));point=exits[0];}if(!point)continue;const unit=spawn(s,'unit',q.unit as UnitType,e.owner,point);if(unit.type!=='villager')unit.home=point;
   }else if(q.kind==='wall'){const d=wallUpgrade(e);if(d){const health=e.hp/e.maxHp;e.type='wall';if(d.age===3)e.wallTier=3;e.maxHp=d.hp;e.hp=Math.min(1,health)*d.hp;event(s,e.owner,`${d.name} completed.`,'complete',e);}}
   else if(q.kind==='age'){s.players[e.owner].age=(s.players[e.owner].age+1)as 2|3;event(s,e.owner,'Your empire has advanced. New buildings and troops are available.','complete');}
   else{s.players[e.owner][q.kind]++;event(s,e.owner,`${q.kind==='weapons'?'Weapons':'Armor'} upgraded.`,'complete');}e.queue.shift();
  }
  if(e.kind!=='unit'||e.type!=='villager'||e.garrisoned)continue;
  if(e.order.kind==='idle')resumeWorkerTask(s,e);
  const o=e.order,target=o.target?s.entities[o.target]:undefined;
  if(o.kind==='idle'&&e.carry){dropoff(s,e,dt,grids[e.owner]);continue;}
  if(!['gather','build','repair'].includes(o.kind))continue;
  if(!target&&o.kind==='build'){nextConstruction(s,e);continue;}
  if(!target){if(e.carry)dropoff(s,e,dt,grids[e.owner]);else assign(e,{kind:'idle'});continue;}
  if(o.kind==='gather'){
   const resource=harvestedResource(target);if(!resource){assign(e,{kind:'idle'});continue;}
   if(e.carry&&(e.carry.amount>=15||o.returning||e.carry.resource!==resource||target.amount<=0)){o.returning=true;dropoff(s,e,dt,grids[e.owner]);continue;}
   if(target.amount<=0){if(resumeWorkerTask(s,e))continue;if(target.type==='farm'&&pay(s,e.owner,{wood:35})){target.amount=900;event(s,e.owner,'A farm has been replanted.');}else{const another=Object.values(s.entities).filter(r=>r.kind==='resource'&&harvestedResource(r)===resource&&r.amount>0&&seen(s,e.owner,r)).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0];assign(e,another?{kind:'gather',target:another.id}:{kind:'idle'});continue;}}
   if(adjacentDistance(e,target)>1.4){travel(s,e,target,dt,grids[e.owner]);continue;}
   const rate=FOOD_SOURCES[target.type as FoodSourceType]?.gatherRate??(resource==='food'?3.6:2.8),n=Math.min(dt*rate,target.amount,15-(e.carry?.amount??0));target.amount-=n;if(!e.carry)e.carry={resource,amount:0};e.carry.amount+=n;if(e.carry.amount>=14.999)o.returning=true;
  }else{
   if(target.owner!==e.owner||target.hp<=0||target.kind!=='building'||(o.kind==='build'&&target.progress>=1)||(o.kind==='repair'&&target.progress<1)){if(o.kind==='build')nextConstruction(s,e);else assign(e,{kind:'idle'});continue;}
   if(adjacentDistance(e,target)>1.7){travel(s,e,approach(s,e,target,grids[e.owner]),dt,grids[e.owner]);continue;}
   const d=BUILDINGS[target.type as keyof typeof BUILDINGS];
   if(o.kind==='build'){
    target.progress=Math.min(1,target.progress+dt/d.seconds);target.hp=Math.max(target.hp,target.maxHp*target.progress);
    if(target.progress===1){event(s,e.owner,`${d.name} completed.`,'complete',target);nextConstruction(s,e);if(e.order.kind==='idle'&&!resumeWorkerTask(s,e)&&target.type==='farm')assign(e,{kind:'gather',target:target.id});}
   }else if(target.hp<target.maxHp){if(pay(s,e.owner,{wood:dt*.3}))target.hp=Math.min(target.maxHp,target.hp+dt*18);}else assign(e,{kind:'idle'});
  }
 }
}
