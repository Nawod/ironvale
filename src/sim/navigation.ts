import type { Entity, GameState, Position } from './types';
import { distance } from './types';
import { BUILDINGS,UNITS } from './definitions';
import {allied} from './teams';
import {environmentFor} from './environment';
import {FOOD_SOURCES} from './nature';
import type {FoodSourceType} from './types';
import {canBuildOnTerrain,isWaterTerrain} from './terrain';
const navigationCache=new WeakMap<GameState,{signature:string;terrain:number[];grids:Uint8Array[]}>();
export function navigationGrids(s:GameState):Uint8Array[]{
 const buildings=Object.values(s.entities).filter(e=>e.kind==='building'&&e.type!=='farm');
 const signature=s.size+'|'+s.players.map(p=>p.team??`p${p.id}`).join(',')+'|'+buildings.map(e=>`${e.id}:${e.type}:${e.x}:${e.y}:${e.owner}`).join('|');
 const prior=navigationCache.get(s);if(prior?.signature===signature&&prior.terrain===s.terrain)return prior.grids;
 const shared=new Map<string,Uint8Array>(),grids=[...s.players.map(p=>p.id),-1].map(owner=>{const key=owner<0?'neutral':s.players[owner].team===undefined?`p${owner}`:`t${s.players[owner].team}`;let grid=shared.get(key);if(!grid){grid=blockedGrid(s,owner);shared.set(key,grid);}return grid;});navigationCache.set(s,{signature,terrain:s.terrain,grids});return grids;
}
export function bounds(s:GameState,p:Position):boolean{return Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=1&&p.y>=1&&p.x<s.size-1&&p.y<s.size-1;}
export function buildingSize(e:Entity):number{return e.kind==='building'?BUILDINGS[e.type as keyof typeof BUILDINGS].size:0;}
/** Only face-adjacent cells are valid exits: a blocked garrison must never
 * teleport through a wall or river to some more distant open tile. */
export function garrisonExit(s:GameState,b:Entity,grid=blockedGrid(s,b.owner)):Position|undefined{
 const preferred={x:b.x-1,y:b.y+1};
 if(bounds(s,preferred)&&!grid[Math.floor(preferred.y)*s.size+Math.floor(preferred.x)])return preferred;
 const n=buildingSize(b);
 for(let dy=-1;dy<=n;dy++)for(let dx=-1;dx<=n;dx++){
  if((dx===-1||dx===n)===(dy===-1||dy===n))continue;
  const p={x:b.x+dx,y:b.y+dy};if(bounds(s,p)&&!grid[Math.floor(p.y)*s.size+Math.floor(p.x)])return p;
 }
 return undefined;
}
export function blockedGrid(s:GameState,owner:number):Uint8Array{
 const grid=new Uint8Array(s.size*s.size);
 for(let i=0;i<s.terrain.length;i++)if(isWaterTerrain(s.terrain[i]))grid[i]=1;
 for(const e of Object.values(s.entities))if(e.kind==='building'&&e.type!=='farm'&&!(e.type==='gate'&&allied(s,e.owner,owner))){
  const n=buildingSize(e);for(let y=Math.floor(e.y);y<e.y+n;y++)for(let x=Math.floor(e.x);x<e.x+n;x++)if(x>=0&&y>=0&&x<s.size&&y<s.size)grid[y*s.size+x]=1;
 }return grid;
}
export function adjacentDistance(a:Position,b:Entity):number {const n=buildingSize(b);return distance(a,{x:Math.max(b.x,Math.min(a.x,b.x+n)),y:Math.max(b.y,Math.min(a.y,b.y+n))});}
export function approach(s:GameState,from:Position,target:Entity,grid:Uint8Array):Position{
 const n=buildingSize(target);if(!n)return target;
 const points:Position[]=[];for(let dx=-1;dx<=n;dx++)for(let dy=-1;dy<=n;dy++){if(dx!==-1&&dx!==n&&dy!==-1&&dy!==n)continue;const p={x:target.x+dx+.5,y:target.y+dy+.5};if(bounds(s,p)&&!grid[Math.floor(p.y)*s.size+Math.floor(p.x)]&&adjacentDistance(p,target)<1.6)points.push(p);}
 points.sort((a,b)=>distance(a,from)-distance(b,from));return points[0]??{x:target.x-1,y:target.y+1};
}
export function canPlace(s:GameState,type:keyof typeof BUILDINGS,p:Position):boolean{
 const n=BUILDINGS[type].size;if(!bounds(s,p)||p.x+n>=s.size-1||p.y+n>=s.size-1||!canBuildOnTerrain(s.terrain,s.size,p.x,p.y,n))return false;
 return !Object.values(s.entities).some(e=>e.kind==='building'&&p.x<e.x+buildingSize(e)&&p.x+n>e.x&&p.y<e.y+buildingSize(e)&&p.y+n>e.y||e.kind==='resource'&&e.amount>0&&e.x>=p.x&&e.x<p.x+n&&e.y>=p.y&&e.y<p.y+n);
}
export function pathfind(s:GameState,start:Position,goal:Position,owner:number,grid=blockedGrid(s,owner),allowPartial=false):Position[]{
 const size=s.size;let gx=Math.max(1,Math.min(size-2,Math.floor(goal.x))),gy=Math.max(1,Math.min(size-2,Math.floor(goal.y)));
 if(grid[gy*size+gx]){let best=Infinity;for(let r=1;r<=5;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const x=gx+dx,y=gy+dy,d=dx*dx+dy*dy;if(x>0&&y>0&&x<size-1&&y<size-1&&!grid[y*size+x]&&d<best){best=d;}}if(best===Infinity)return [];
  let choices:Position[]=[];for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const x=gx+dx,y=gy+dy;if(x>0&&y>0&&x<size-1&&y<size-1&&!grid[y*size+x]&&dx*dx+dy*dy===best)choices.push({x,y});}choices.sort((a,b)=>distance(a,start)-distance(b,start));gx=choices[0].x;gy=choices[0].y;
 }
 const sx=Math.floor(start.x),sy=Math.floor(start.y),begin=sy*size+sx,end=gy*size+gx;
 if(begin===end)return [{x:gx+.5,y:gy+.5}];
 const parent=new Int32Array(size*size).fill(-1),cost=new Float32Array(size*size).fill(Infinity);cost[begin]=0;
 const route=(end:number):Position[]=>{const out:Position[]=[];let c=end;while(c!==begin&&c>=0){out.push({x:c%size+.5,y:Math.floor(c/size)+.5});c=parent[c];}return out.reverse();};
 let closest=begin,closestDistance=(gx-sx)**2+(gy-sy)**2;
 const open:{id:number;score:number}[]=[{id:begin,score:0}],closed=new Uint8Array(size*size);let iter=0;
 const push=(v:{id:number;score:number})=>{open.push(v);let i=open.length-1;while(i>0){const p=(i-1)>>1;if(open[p].score<=v.score)break;open[i]=open[p];i=p;}open[i]=v;};
 const pop=()=>{const out=open[0],tail=open.pop()!;if(open.length){let i=0;while(i*2+1<open.length){let c=i*2+1;if(c+1<open.length&&open[c+1].score<open[c].score)c++;if(open[c].score>=tail.score)break;open[i]=open[c];i=c;}open[i]=tail;}return out;};
 while(open.length&&iter<size*size){const id=pop().id;if(closed[id])continue;iter++;closed[id]=1;if(id===end)return route(end);
  const x=id%size,y=Math.floor(id/size),remaining=(gx-x)**2+(gy-y)**2;
  if(allowPartial&&(remaining<closestDistance||remaining===closestDistance&&cost[id]<cost[closest])){closest=id;closestDistance=remaining;}
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=size-1||ny>=size-1)continue;const next=ny*size+nx;if(closed[next]||grid[next]||dx&&dy&&(grid[y*size+nx]||grid[ny*size+x]))continue;const g=cost[id]+(dx&&dy?Math.SQRT2:1);if(g>=cost[next])continue;cost[next]=g;parent[next]=id;push({id:next,score:g+Math.max(Math.abs(gx-nx),Math.abs(gy-ny))+(Math.SQRT2-1)*Math.min(Math.abs(gx-nx),Math.abs(gy-ny))});}
 }
 // Only actual travel opts into a frontier route. Strategic reachability tests
 // (including AI breach selection) continue to receive [] for blocked routes.
 return allowPartial&&closest!==begin?route(closest):[];
}
export function travel(s:GameState,e:Entity,goal:Position,dt:number,grid:Uint8Array):boolean{
 goal={x:Math.floor(goal.x)+.5,y:Math.floor(goal.y)+.5};
 if(distance(e,goal)<.35){e.path=[];return true;}
 const changed=!e.pathGoal||distance(e.pathGoal,goal)>1;
 if(!changed&&!e.path.length&&s.tick<(e.nextPathTick??0))return false;
 const next=e.path[0];if(changed||!e.path.length||next&&grid[Math.floor(next.y)*s.size+Math.floor(next.x)]){e.path=pathfind(s,e,goal,e.owner,grid,true);e.pathGoal={...goal};e.nextPathTick=s.tick+(e.path.length?0:40);}
 if(!e.path.length)return false;
 const p=e.path[0],d=distance(e,p),speed=(FOOD_SOURCES[e.type as FoodSourceType]?.speed??UNITS[e.type as keyof typeof UNITS]?.speed??2.25)*environmentFor(s).movement*dt;
 if(d<=speed){e.x=p.x;e.y=p.y;e.path.shift();
  // A blocked requested tile is redirected by pathfind to a reachable perimeter
  // tile. Consuming that final waypoint completes the journey as well.
  if(!e.path.length)return true;
 }else{e.x+=(p.x-e.x)*speed/d;e.y+=(p.y-e.y)*speed/d;}return distance(e,goal)<.35;
}
