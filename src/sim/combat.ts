import type {Entity,GameState} from './types';
import {distance,military} from './types';
import {BUILDINGS,UNITS} from './definitions';
import {adjacentDistance,travel} from './navigation';
import {seen} from './visibility';
import {assign,event} from './economy';
export function attackDamage(s:GameState,a:Entity,b:Entity):number{
 const p=s.players[a.owner];let damage=a.kind==='building'?(BUILDINGS[a.type as keyof typeof BUILDINGS].damage??0)+a.garrison.length*3:UNITS[a.type as keyof typeof UNITS].damage;
 damage+=p.weapons*3;
 if(a.type==='spearman'&&(b.type==='cavalry'||b.type==='scout'))damage*=2.8;
 if(a.type==='cavalry'&&b.type==='archer')damage*=1.6;
 if(a.type==='archer'&&b.type==='spearman')damage*=1.5;
 if(a.type==='ram'||a.type==='trebuchet')damage*=b.kind==='building'?3:.2;
 const armor=b.kind==='unit'?UNITS[b.type as keyof typeof UNITS].armor+(s.players[b.owner]?.armor??0)*2:2;
 return Math.max(1,damage-armor);
}
function kill(s:GameState,e:Entity):void{
 for(const id of e.garrison){const unit=s.entities[id];if(unit){unit.garrisoned=undefined;unit.x=e.x-1;unit.y=e.y+1;assign(unit,{kind:'idle'});}}e.garrison=[];e.queue=[];
 if(e.type==='capital'&&s.players[e.owner]?.capital===e.id){e.hp=0;event(s,e.owner,'Your capital has fallen. Clear the occupiers and rebuild!','attack',e);}
 else delete s.entities[e.id];
}
export function updateCombat(s:GameState,dt:number,grids:Uint8Array[]):void{
 const entities=Object.values(s.entities),buckets=new Map<string,Entity[]>();
 for(const e of entities)if(e.owner>=0&&e.hp>0&&!e.garrisoned){const key=`${Math.floor(e.x/8)},${Math.floor(e.y/8)}`;const b=buckets.get(key)??[];b.push(e);buckets.set(key,b);}
 const nearby=(e:Entity,r:number):Entity[]=>{const out:Entity[]=[];for(let y=Math.floor((e.y-r)/8);y<=Math.floor((e.y+r)/8);y++)for(let x=Math.floor((e.x-r)/8);x<=Math.floor((e.x+r)/8);x++)out.push(...(buckets.get(`${x},${y}`)??[]));return out;};
 for(const e of entities){
  if(!s.entities[e.id]||e.owner<0||e.hp<=0||e.garrisoned||e.kind==='building'&&e.progress<1)continue;
  e.cooldown=Math.max(0,e.cooldown-dt);
  const def=e.kind==='unit'?UNITS[e.type as keyof typeof UNITS]:BUILDINGS[e.type as keyof typeof BUILDINGS];
  const order=e.order;let target=order.kind==='attack'&&order.target?s.entities[order.target]:undefined;
  if(target&&(target.hp<=0||!seen(s,e.owner,target))){target=undefined;assign(e,{kind:'idle'});}
  const auto=e.kind==='building'?!!(def as typeof BUILDINGS.capital).damage:e.type!=='villager'&&!['move','garrison'].includes(order.kind)&&e.stance!=='hold';
  if(!target&&auto){const r=e.kind==='building'?(def.range??0):Math.max(6,def.range??0);target=nearby(e,r).filter(t=>t.owner!==e.owner&&t.hp>0&&s.entities[t.id]&&seen(s,e.owner,t)&&adjacentDistance(e,t)<=r&&!(e.stance==='defensive'&&e.home&&distance(t,e.home)>7)).sort((a,b)=>(a.kind==='unit'?0:3)+adjacentDistance(e,a)-((b.kind==='unit'?0:3)+adjacentDistance(e,b)))[0];}
  if(target){const range=def.range??0;if(adjacentDistance(e,target)<=range){if(e.cooldown<=0){target.hp-=attackDamage(s,e,target);e.attackFx={x:target.x,y:target.y,tick:s.tick};e.cooldown=e.type==='trebuchet'?3:e.type==='ram'?2:1.15;
    const latest=[...s.events].reverse().find(v=>v.player===target!.owner&&v.kind==='attack');if(!latest||s.tick-latest.tick>200)event(s,target.owner,'Your empire is under attack.','attack',target);
    if(target.hp<=0)kill(s,target);
   }}else if(e.kind==='unit'&&e.stance!=='hold')travel(s,e,target,dt,grids[e.owner]);continue;}
  if(e.kind!=='unit')continue;
  if(['move','attackMove','patrol'].includes(order.kind)&&order.point){
   if(travel(s,e,order.point,dt,grids[e.owner])){if(order.kind==='patrol'&&order.origin){const p=order.point;order.point=order.origin;order.origin=p;e.path=[];e.pathGoal=undefined;}else assign(e,{kind:'idle'});}
  }else if(order.kind==='garrison'&&order.target){const b=s.entities[order.target],slots=b?BUILDINGS[b.type as keyof typeof BUILDINGS]?.slots??0:0;if(!b||b.owner!==e.owner||b.garrison.length>=slots){assign(e,{kind:'idle'});continue;}if(adjacentDistance(e,b)<1.7){b.garrison.push(e.id);e.garrisoned=b.id;assign(e,{kind:'idle'});}else travel(s,e,{x:b.x-1,y:b.y+1},dt,grids[e.owner]);}
  else if(order.kind==='attack')assign(e,{kind:'idle'});
 }
}
export function updateConquest(s:GameState,dt:number):void{
 for(const p of s.players){
  if(!p.alive)continue;const cap=s.entities[p.capital];if(!cap||cap.hp>0)continue;
  const nearby=Object.values(s.entities).filter(e=>military(e)&&!e.garrisoned&&e.hp>0&&distance(e,{x:cap.x+1.5,y:cap.y+1.5})<6);
  const factions=[...new Set(nearby.map(e=>e.owner))],attackers=factions.filter(id=>id!==p.id&&s.players[id]?.alive);
  if(cap.occupation&&!attackers.includes(cap.occupation.owner))cap.occupation=undefined;
  if(!cap.occupation&&attackers.length===1)cap.occupation={owner:attackers[0],progress:0};
  if(!cap.occupation||factions.length!==1)continue;
  cap.occupation.progress+=dt;if(cap.occupation.progress<30-1e-8)continue;
  const conqueror=cap.occupation.owner;p.alive=false;
  for(const e of Object.values(s.entities))if(e.owner===p.id){
   if(e.kind==='unit'&&e.type!=='villager'){delete s.entities[e.id];continue;}
   e.owner=conqueror;e.queue=[];e.garrison=[];e.garrisoned=undefined;assign(e,{kind:'idle'});
  }
  cap.type='outpost';cap.hp=BUILDINGS.outpost.hp;cap.maxHp=cap.hp;cap.progress=1;cap.occupation=undefined;
  event(s,-1,`${s.players[conqueror].name} conquered ${p.name}.`,'capture',cap);
  const alive=s.players.filter(v=>v.alive);if(alive.length===1){s.winner=alive[0].id;event(s,-1,`${alive[0].name} controls Ironvale.`,'capture');return;}
 }
}
