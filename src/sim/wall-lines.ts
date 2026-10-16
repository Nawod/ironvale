import type {Command,Entity,GameState,Position,Resource,Resources} from './types';
import {BUILDINGS} from './definitions';
import {bounds,buildingSize} from './navigation';
import {canBuildOnTerrain} from './terrain';
import {validSelection} from './formations';
import {assignTask,MAX_WORKER_TASKS,pendingTaskCount} from './tasks';
import {spawn} from './world';

export const MAX_WALL_LINE_TILES=64;
/** Map-independent route shared by the preview, network guard and simulation.
 * Validate coordinates and length before allocating or walking the route. */
export function wallLineTiles(start:Position,end:Position):Position[]|undefined{
 if(!start||!end||![start.x,start.y,end.x,end.y].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=256))return undefined;
 const x=Math.floor(start.x),y=Math.floor(start.y),ex=Math.floor(end.x),ey=Math.floor(end.y);
 if(Math.abs(ex-x)+Math.abs(ey-y)+1>MAX_WALL_LINE_TILES)return undefined;
 const tiles:Position[]=[{x,y}],dx=Math.sign(ex-x),dy=Math.sign(ey-y);
 for(let cx=x;cx!==ex;){cx+=dx;tiles.push({x:cx,y});}
 for(let cy=y;cy!==ey;){cy+=dy;tiles.push({x:ex,y:cy});}
 return tiles;
}
const unfinishedWall=(s:GameState,owner:number,id:number|undefined)=>{const b=s.entities[id??0];return !!b&&b.kind==='building'&&b.owner===owner&&b.hp>0&&b.progress<1&&(b.type==='palisade'||b.type==='wall');};
/** Prepare on a clone so every selected worker can be checked before purchase.
 * A fortification sequence continues FIFO, across wood and stone materials. */
export function wallWorkerPlan(s:GameState,w:Entity,ids:readonly number[]):Entity{
 const plan=structuredClone(w);
 if(plan.order.kind==='build'&&(unfinishedWall(s,w.owner,plan.order.target)||(plan.buildQueue??[]).some(id=>unfinishedWall(s,w.owner,id)))){
  const queued=new Set([plan.order.target,...(plan.buildQueue??[])]),more=ids.filter(id=>!queued.has(id));
  if(more.length)plan.buildQueue=[...(plan.buildQueue??[]),...more];
 }else{
  assignTask(s,plan,{kind:'build',target:ids[0]});
  const queued=new Set([plan.order.target,...(plan.buildQueue??[])]),more=ids.slice(1).filter(id=>!queued.has(id));
  if(more.length)plan.buildQueue=[...(plan.buildQueue??[]),...more];
 }
 return plan;
}
export function applyWallLine(s:GameState,c:Extract<Command,{type:'buildWallLine'}>):string|null{
 if(c.building!=='palisade'&&c.building!=='wall')return 'Choose wooden or stone walls for a wall line.';
 const route=wallLineTiles(c.start,c.end);if(!route)return `Choose a wall line of at most ${MAX_WALL_LINE_TILES} tiles within the map.`;
 const p=s.players[c.player],d=BUILDINGS[c.building];if(p.age<d.age)return 'Advance your empire to unlock this building.';
 if(!validSelection(c.workers))return 'Choose a valid villager selection.';
 const workers=[...new Set(c.workers)].map(id=>s.entities[id]).filter((e):e is Entity=>!!e&&e.kind==='unit'&&e.type==='villager'&&e.owner===c.player&&e.hp>0&&!e.garrisoned);
 if(!workers.length)return 'Select a villager to build.';
 if(route.some(t=>!bounds(s,t)||t.x+1>=s.size-1||t.y+1>=s.size-1))return 'Choose clear land within the map for this wall line.';
 // Entire-route visibility precedes all terrain and obstacle reads. An unseen
 // endpoint must never make a visible blocked tile disclose hidden map data.
 if(route.some(t=>!s.visible[c.player][t.y*s.size+t.x]))return 'Scout this land before building.';
 const obstacles=Object.values(s.entities).filter(e=>e.kind==='building'||e.kind==='resource'&&e.amount>0),newTiles:Position[]=[],jobs:number[]=[];
 let nextId=s.nextId;
 for(const t of route){
  if(!canBuildOnTerrain(s.terrain,s.size,t.x,t.y,1,s.elevation))return 'Choose clear land for this wall line.';
  let existing:Entity|undefined;
  for(const e of obstacles){
   const n=buildingSize(e),overlaps=e.kind==='building'?t.x<e.x+n&&t.x+1>e.x&&t.y<e.y+n&&t.y+1>e.y:e.x>=t.x&&e.x<t.x+1&&e.y>=t.y&&e.y<t.y+1;
   if(!overlaps)continue;
   if(e.kind!=='building'||e.owner!==c.player||e.hp<=0||(e.type!=='palisade'&&e.type!=='wall')||e.x!==t.x||e.y!==t.y||existing)return 'Choose clear land for this wall line.';
   existing=e;
  }
  if(existing){if(existing.progress<1)jobs.push(existing.id);}else{newTiles.push(t);jobs.push(nextId++);}
 }
 if(!jobs.length)return 'This line is already built.';
 const plans=workers.map(w=>wallWorkerPlan(s,w,jobs));
 if(plans.some(w=>pendingTaskCount(w)>MAX_WORKER_TASKS))return 'Worker task list is full. Finish tasks or use Stop to clear it.';
 const cost:Partial<Resources>={};for(const [r,n]of Object.entries(d.cost))cost[r as Resource]=n!*newTiles.length;
 if(Object.entries(cost).some(([r,n])=>p.resources[r as Resource]<n!))return 'Not enough resources.';
 for(const [r,n]of Object.entries(cost))p.resources[r as Resource]-=n!;
 for(const t of newTiles){const b=spawn(s,'building',c.building,c.player,t);b.progress=0;b.hp=1;}
 for(let i=0;i<workers.length;i++)Object.assign(workers[i],plans[i]);
 return null;
}
