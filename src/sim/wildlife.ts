import type {GameState} from './types';
import {random} from './world';
import {blockedGrid,bounds,travel} from './navigation';
/** Wildlife belongs to the shared simulation, so hunters and online viewers agree. */
export function updateWildlife(s:GameState,dt:number):void{
 const entities=Object.values(s.entities),deer=entities.filter(e=>e.type==='deer'&&e.amount>0);if(!deer.length)return;const grid=blockedGrid(s,-1);
 for(const e of deer){e.home??={x:e.x,y:e.y};if(entities.some(w=>w.type==='villager'&&w.order.kind==='gather'&&w.order.target===e.id&&Math.hypot(w.x-e.x,w.y-e.y)<2)){e.path=[];continue;}
  if(e.order.kind!=='move'||!e.order.point){if(s.tick<(e.nextPathTick??0))continue;const angle=random(s)*Math.PI*2,radius=1+random(s)*2,point={x:e.home.x+Math.cos(angle)*radius,y:e.home.y+Math.sin(angle)*radius};if(!bounds(s,point)||grid[Math.floor(point.y)*s.size+Math.floor(point.x)]){e.nextPathTick=s.tick+40;continue;}e.order={kind:'move',point};e.path=[];}
  if(travel(s,e,e.order.point!,dt,grid)){e.order={kind:'idle'};e.nextPathTick=s.tick+30+Math.floor(random(s)*70);}else if(!e.path.length){e.order={kind:'idle'};e.nextPathTick=s.tick+40;}
 }
}
