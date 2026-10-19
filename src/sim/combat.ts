import {airborne,buildingStats,canAttack,flightHeight,unitStats} from './factions';
import type {Entity,GameState} from './types';
import {distance,military} from './types';
import {allied,hostile,allianceKey} from './teams';
import {BUILDINGS,UNITS} from './definitions';
import {adjacentDistance,approach,travel,garrisonExit} from './navigation';
import {seen} from './visibility';
import {assign,event} from './economy';
import {assignZombie,isZombie,zombieNight} from './zombies';
import {attackRange,clearAttackLine,counterPreference} from './combat-tactics';
function combatOrder(e:Entity,order:Entity['order']):void{if(isZombie(e))assignZombie(e,order);else assign(e,order);}
export function attackDamage(s:GameState,a:Entity,b:Entity):number{
 if(!canAttack(a,b))return 0;
 const p=s.players[a.owner];let damage=a.kind==='building'?(buildingStats(a.type as keyof typeof BUILDINGS,p).damage??0)+a.garrison.length*3:unitStats(a.type as keyof typeof UNITS,p).damage;
 damage+=(p?.weapons??0)*3;
 if(['spearman','pikeman'].includes(a.type)&&['cavalry','heavyCavalry','scout','warElephant'].includes(b.type))damage*=2.8;
 if(['cavalry','heavyCavalry'].includes(a.type)&&['archer','crossbowman','musketeer','rifleman'].includes(b.type))damage*=1.6;
 if(['archer','crossbowman','musketeer','rifleman'].includes(a.type)&&['spearman','pikeman'].includes(b.type))damage*=1.5;
 if(a.type==='warElephant'&&['spearman','pikeman'].includes(b.type))damage*=.7;
 if(a.type==='champion'&&['spearman','pikeman','swordsman'].includes(b.type))damage*=1.25;
 if(a.type==='ram'||a.type==='trebuchet'||a.type==='cannon')damage*=b.kind==='building'?3:.2;
 const armor=b.kind==='unit'?unitStats(b.type as keyof typeof UNITS,s.players[b.owner]).armor+(s.players[b.owner]?.armor??0)*2:2;
 return Math.max(1,damage-armor);
}
function kill(s:GameState,e:Entity):void{
 const exit=e.garrison.length?garrisonExit(s,e):undefined;
 // A destroyed enclosure opens its own dry footprint. If its perimeter was
 // sealed, survivors emerge there instead of skipping the surrounding siege.
 for(const id of e.garrison){const unit=s.entities[id];if(unit){unit.garrisoned=undefined;unit.x=exit?.x??e.x;unit.y=exit?.y??e.y;assign(unit,{kind:'idle'});}}e.garrison=[];e.queue=[];
 if(e.type==='capital'&&s.players[e.owner]?.capital===e.id){e.hp=0;event(s,e.owner,'Your capital has fallen. Clear the occupiers and rebuild!','attack',e);}
 else delete s.entities[e.id];
}
export function updateCombat(s:GameState,dt:number,grids:Uint8Array[]):void{
 const entities=Object.values(s.entities),buckets=new Map<string,Entity[]>();
 for(const e of entities)if((e.owner>=0||isZombie(e))&&e.hp>0&&!e.garrisoned){const key=`${Math.floor(e.x/8)},${Math.floor(e.y/8)}`;const b=buckets.get(key)??[];b.push(e);buckets.set(key,b);}
 const nearby=(e:Entity,r:number):Entity[]=>{const out:Entity[]=[];for(let y=Math.floor((e.y-r)/8);y<=Math.floor((e.y+r)/8);y++)for(let x=Math.floor((e.x-r)/8);x<=Math.floor((e.x+r)/8);x++)out.push(...(buckets.get(`${x},${y}`)??[]));return out;};
 for(const e of entities){
  const zombie=isZombie(e),grid=grids[e.owner<0?s.players.length:e.owner];
  if(!s.entities[e.id]||e.owner<0&&!zombie||zombie&&(!s.config.zombies||!zombieNight(s))||e.hp<=0||e.garrisoned||e.kind==='building'&&e.progress<1)continue;
  e.cooldown=Math.max(0,e.cooldown-dt);
  const def=e.kind==='unit'?UNITS[e.type as keyof typeof UNITS]:BUILDINGS[e.type as keyof typeof BUILDINGS];
  const order=e.order;let target=order.kind==='attack'&&order.target?s.entities[order.target]:undefined;
  if(target&&(target.hp<=0||!canAttack(e,target)||!hostile(s,e.owner,target.owner)||target.garrisoned||!zombie&&!seen(s,e.owner,target))){target=undefined;combatOrder(e,{kind:'idle'});}
  const auto=!zombie&&(e.kind==='building'?!!(def as typeof BUILDINGS.capital).damage:e.type!=='villager'&&!['move','garrison'].includes(order.kind));
  if(!target&&auto){const fixed=e.kind==='building'||e.stance==='hold',r=fixed?attackRange(s,e).max:Math.max(6,attackRange(s,e).max);let best=Infinity;for(const t of nearby(e,r)){if(!canAttack(e,t)||!hostile(s,e.owner,t.owner)||t.hp<=0||t.garrisoned||!s.entities[t.id]||!seen(s,e.owner,t))continue;const d=adjacentDistance(e,t),reach=fixed?attackRange(s,e,t).max:Math.max(6,attackRange(s,e,t).max);if(d>reach||e.stance==='defensive'&&e.home&&distance(t,e.home)>7)continue;const score=(t.kind==='unit'?0:3)+d-counterPreference(e,t);if(score<best){best=score;target=t;}}}
  if(target){const range=attackRange(s,e,target).max;if(adjacentDistance(e,target)<=range&&clearAttackLine(s,e,target)){if(e.cooldown<=0){target.hp-=attackDamage(s,e,target);if(target.kind==='building')target.lastDamagedTick=s.tick;e.attackFx={x:target.x,y:target.y,tick:s.tick,...(flightHeight(target)?{height:flightHeight(target)}:{})};e.cooldown=e.type==='trebuchet'?3:e.type==='cannon'?3.5:['musketeer','rifleman'].includes(e.type)?2:e.type==='ram'?2:1.15;
    const latest=[...s.events].reverse().find(v=>v.player===target!.owner&&v.kind==='attack');if(target.owner>=0&&(!latest||s.tick-latest.tick>200))event(s,target.owner,'Your empire is under attack.','attack',target);
    if(target.hp<=0)kill(s,target);
   }}else if(e.kind==='unit'&&e.stance!=='hold')travel(s,e,zombie||s.elevation&&range>2?approach(s,e,target,grid):target,dt,grid);continue;}
  if(e.kind!=='unit')continue;
  if(['move','attackMove','patrol'].includes(order.kind)&&order.point){
   if(travel(s,e,order.point,dt,grid)){if(order.kind==='patrol'&&order.origin){const p=order.point;order.point=order.origin;order.origin=p;e.path=[];e.pathGoal=undefined;}else combatOrder(e,{kind:'idle'});}
  }else if(order.kind==='garrison'&&order.target){if(airborne(e)){combatOrder(e,{kind:'idle'});continue;}const b=s.entities[order.target],slots=b?BUILDINGS[b.type as keyof typeof BUILDINGS]?.slots??0:0;if(!b||b.owner!==e.owner||b.garrison.length>=slots){combatOrder(e,{kind:'idle'});continue;}if(adjacentDistance(e,b)<1.7){b.garrison.push(e.id);e.garrisoned=b.id;combatOrder(e,{kind:'idle'});}else travel(s,e,{x:b.x-1,y:b.y+1},dt,grid);}
  else if(order.kind==='attack')combatOrder(e,{kind:'idle'});
 }
}
export function updateConquest(s:GameState,dt:number):void{
 for(const p of s.players){
  if(!p.alive)continue;const cap=s.entities[p.capital];if(!cap||cap.hp>0)continue;
  const nearby=Object.values(s.entities).filter(e=>military(e)&&!airborne(e)&&!e.garrisoned&&e.hp>0&&distance(e,{x:cap.x+1.5,y:cap.y+1.5})<6);
  const factions=[...new Set(nearby.map(e=>e.owner))],attackers=factions.filter(id=>hostile(s,id,p.id)&&s.players[id]?.alive);
  if(cap.occupation&&!attackers.includes(cap.occupation.owner))cap.occupation=undefined;
  if(!cap.occupation&&attackers.length&&attackers.every(id=>allied(s,id,attackers[0])))cap.occupation={owner:attackers[0],progress:0};
  if(!cap.occupation||factions.some(id=>!allied(s,id,cap.occupation!.owner)))continue;
  cap.occupation.progress+=dt;if(cap.occupation.progress<30-1e-8)continue;
  const conqueror=cap.occupation.owner;p.alive=false;
  for(const e of Object.values(s.entities))if(e.owner===p.id){
   if(e.kind==='unit'&&e.type!=='villager'){delete s.entities[e.id];continue;}
   const health=Math.max(0,Math.min(1,e.hp/e.maxHp));e.owner=conqueror;
   const maxHp=e.kind==='building'?(e.wallTier===3?1400:buildingStats(e.type as keyof typeof BUILDINGS,s.players[conqueror]).hp):unitStats(e.type as keyof typeof UNITS,s.players[conqueror]).hp;e.maxHp=maxHp;e.hp=maxHp*health;e.rally=undefined;e.queue=[];e.garrison=[];e.garrisoned=undefined;e.taskQueue=undefined;assign(e,{kind:'idle'});
  }
  cap.type='outpost';cap.hp=buildingStats('outpost',s.players[conqueror]).hp;cap.maxHp=cap.hp;cap.progress=1;cap.occupation=undefined;
  event(s,-1,`${s.players[conqueror].name} conquered ${p.name}.`,'capture',cap);
  const alive=s.players.filter(v=>v.alive);if(new Set(alive.map(allianceKey)).size===1){s.winner=alive[0].id;event(s,-1,alive[0].team===undefined?`${alive[0].name} controls Kingdom Lanka.`:`Team ${alive[0].team+1} controls Kingdom Lanka.`,'capture');return;}
 }
}
