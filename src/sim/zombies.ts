import {airborne,canAttack} from './factions';
import type {Entity,GameState,Position} from './types';
import {distance} from './types';
import {environmentFor} from './environment';
import {adjacentDistance,approach,bounds,pathfind,travel} from './navigation';
import {spawn} from './world';
import {assign} from './tasks';

export const isZombie=(e:Entity):boolean=>e.kind==='unit'&&e.type==='zombie'&&e.owner===-2;
/** Generic unit assignments reset defensive home; undead retain their forest refuge. */
export function assignZombie(e:Entity,order:Entity['order']):void{const refuge=e.home??{x:e.x,y:e.y};assign(e,order);e.home=refuge;}
export function zombieNight(s:GameState):boolean{const hour=environmentFor(s).hour;return hour>=18||hour<6;}
const cityCenter=(e:Entity):Position=>({x:e.x+1.5,y:e.y+1.5});
/** A local hash keeps optional waves independent of the ordinary simulation RNG. */
function hash(seed:number,n:number):number{let v=Math.imul(seed^n,0x45d9f3b);v=Math.imul(v^(v>>>16),0x45d9f3b);return (v^(v>>>16))>>>0;}
function refill(s:GameState,cities:Entity[],zombies:Entity[],grid:Uint8Array,cycle:number):void{
 const trees=Object.values(s.entities).filter(e=>e.kind==='resource'&&e.type==='wood'&&e.amount>0);
 const desired=Math.min(12,8+Math.floor(cycle/2));let total=zombies.length;
 const nearestCity=(p:Position)=>cities.reduce((best,c)=>distance(p,cityCenter(c))<distance(p,cityCenter(best))?c:best,cities[0]);
 for(const city of cities){
  let count=zombies.filter(z=>nearestCity(z.home??z).id===city.id).length;if(count>=desired||total>=96)continue;
  // Only real tree clusters outside every city's safe radius are eligible.
  const candidates=trees.filter(t=>cities.every(c=>distance(t,cityCenter(c))>=17)&&nearestCity(t).id===city.id).sort((a,b)=>distance(a,city)-distance(b,city)||a.id-b.id).slice(0,80);
  const forests=candidates.filter(t=>trees.filter(v=>distance(v,t)<6).length>=3);
  for(let attempt=0;attempt<96&&count<desired&&total<96&&forests.length;attempt++){
   const n=hash(s.config.seed,cycle*997+city.id*131+attempt),tree=forests[n%forests.length],angle=(n%6283)/1000;
   const point={x:Math.floor(tree.x+Math.cos(angle)*2)+.5,y:Math.floor(tree.y+Math.sin(angle)*2)+.5};
   if(!bounds(s,point)||nearestCity(point).id!==city.id||grid[Math.floor(point.y)*s.size+Math.floor(point.x)]||cities.some(c=>distance(point,cityCenter(c))<16)||Object.values(s.entities).some(e=>e.hp>0&&distance(e,point)<.7))continue;
   const zombie=spawn(s,'unit','zombie',-2,point);zombie.home={...point};zombies.push(zombie);count++;total++;
  }
 }
}
/** The authoritative clock owns spawning, goals and dawn retreat, including reconnects. */
export function updateZombies(s:GameState,dt:number,grid:Uint8Array):void{
 if(!s.config.zombies)return;
 const zombies=Object.values(s.entities).filter(e=>isZombie(e)&&e.hp>0),night=zombieNight(s);
 if(!night){
  for(const z of zombies){z.home??={x:z.x,y:z.y};if(z.order.kind!=='move'||!z.order.point||distance(z.order.point,z.home)>.1)assignZombie(z,{kind:'move',point:{...z.home}});if(travel(s,z,z.home,dt,grid))assignZombie(z,{kind:'idle'});}
  return;
 }
 const cities=s.players.filter(p=>p.alive).map(p=>s.entities[p.capital]).filter((e):e is Entity=>!!e);
 if(!cities.length)return;
 const cycle=Math.max(0,Math.floor((s.tick-12000)/28800));
 if(s.zombieNight!==cycle){s.zombieNight=cycle;refill(s,cities,zombies,grid,cycle);}
 const targets=Object.values(s.entities).filter(e=>!airborne(e)&&e.owner>=0&&s.players[e.owner]?.alive&&e.hp>0&&!e.garrisoned&&(e.kind==='unit'||e.kind==='building'));
 const walls=targets.filter(e=>e.kind==='building'&&['palisade','wall','gate'].includes(e.type));
 for(const z of zombies){
  z.home??={x:z.x,y:z.y};const current=z.order.target?s.entities[z.order.target]:undefined;
  if(current&&canAttack(z,current)&&current.hp>0&&z.order.kind==='attack'&&(s.tick+z.id)%20!==0)continue;
  const local=targets.filter(t=>adjacentDistance(z,t)<=8).sort((a,b)=>(a.kind==='unit'?0:3)+adjacentDistance(z,a)-((b.kind==='unit'?0:3)+adjacentDistance(z,b))||a.id-b.id);
  const city=cities.slice().sort((a,b)=>distance(z,cityCenter(a))-distance(z,cityCenter(b))||a.id-b.id)[0];
  const objective=local[0]??(city.hp>0?city:targets.filter(t=>t.owner===city.owner).sort((a,b)=>distance(z,a)-distance(z,b)||a.id-b.id)[0]);
  if(!objective){assignZombie(z,{kind:'idle'});continue;}
  const reachable=(t:Entity)=>adjacentDistance(z,t)<=1.25||pathfind(s,z,approach(s,z,t,grid),-2,grid).length>0;
  let target=objective;
  if(!reachable(target)){
   const breach=walls.slice().sort((a,b)=>distance(z,a)-distance(z,b)||a.id-b.id).slice(0,24).find(reachable);
   if(breach)target=breach;
  }
  if(z.order.kind!=='attack'||z.order.target!==target.id)assignZombie(z,{kind:'attack',target:target.id});
 }
}
