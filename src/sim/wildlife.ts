import type {GameState} from './types';
import {random} from './world';
import {blockedGrid,bounds,travel} from './navigation';
import {isAnimal} from './nature';
/** Wildlife belongs to the shared simulation, so hunters and online viewers agree. */
export function updateWildlife(s:GameState,dt:number,grid=blockedGrid(s,-1)):void{
 const entities=Object.values(s.entities),deer=entities.filter(e=>isAnimal(e)&&e.amount>0);if(!deer.length)return;
 const hunted=new Set<number>();for(const w of entities)if(w.type==='villager'&&w.order.kind==='gather'&&w.order.target){const target=s.entities[w.order.target];if(target&&isAnimal(target)&&Math.hypot(w.x-target.x,w.y-target.y)<2)hunted.add(target.id);}
 for(const e of deer){e.home??={x:e.x,y:e.y};if(hunted.has(e.id)){e.path=[];continue;}
  if(e.order.kind!=='move'||!e.order.point){if(s.tick<(e.nextPathTick??0))continue;const angle=random(s)*Math.PI*2,radius=1+random(s)*2,point={x:e.home.x+Math.cos(angle)*radius,y:e.home.y+Math.sin(angle)*radius};if(!bounds(s,point)||grid[Math.floor(point.y)*s.size+Math.floor(point.x)]){e.nextPathTick=s.tick+40;continue;}e.order={kind:'move',point};e.path=[];}
  if(travel(s,e,e.order.point!,dt,grid)){e.order={kind:'idle'};e.nextPathTick=s.tick+30+Math.floor(random(s)*70);}else if(!e.path.length){e.order={kind:'idle'};e.nextPathTick=s.tick+40;}
 }
}
