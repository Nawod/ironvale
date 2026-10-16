import type {Entity,Formation,GameState,Position} from './types';
import {blockedGrid,buildingSize} from './navigation';
import {seen} from './visibility';

export const FORMATIONS:readonly Formation[]=['line','box','spread'];
export const validSelection=(ids:unknown):ids is number[]=>Array.isArray(ids)&&ids.length>0&&ids.length<=1000&&ids.every(id=>Number.isSafeInteger(id)&&id>0);
const role=(e:Entity)=>['ram','trebuchet'].includes(e.type)?2:['archer','crossbowman'].includes(e.type)?1:0;

/** One flood fill per command, never one path search per soldier. Slots use actual
 * navigation cells, so rounding during travel cannot collapse nearby troops. */
export function formationDestinations(s:GameState,units:Entity[],destination:Position):Map<number,Position>{
 const result=new Map<number,Position>();if(!units.length)return result;
 // Destination orders are returned to the player immediately. Hidden live
 // obstacles must not alter those orders and disclose their current footprints.
 const owner=units[0].owner,known:Record<number,Entity>={};
 for(const e of Object.values(s.entities))if(e.kind==='building'&&seen(s,owner,e))known[e.id]=e;
 for(const e of Object.values(s.intel[owner]))if(e.kind==='building'&&!known[e.id])known[e.id]=e;
 const size=s.size,grid=blockedGrid({...s,entities:known},owner),labels=new Int32Array(size*size),queue=new Int32Array(size*size),regions=new Map<number,{minX:number;minY:number;maxX:number;maxY:number;remaining:number}>();
 const endpoint=grid.slice();
 for(const e of Object.values(known))for(let y=Math.floor(e.y);y<e.y+buildingSize(e);y++)for(let x=Math.floor(e.x);x<e.x+buildingSize(e);x++)if(x>=0&&y>=0&&x<size&&y<size)endpoint[y*size+x]=1;
 let label=0;
 for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){
  const begin=y*size+x;if(grid[begin]||labels[begin])continue;
  labels[begin]=++label;let head=0,tail=1;queue[0]=begin;const region={minX:size,minY:size,maxX:0,maxY:0,remaining:0};
  while(head<tail){const id=queue[head++],cx=id%size,cy=Math.floor(id/size);if(!endpoint[id]){region.minX=Math.min(region.minX,cx);region.minY=Math.min(region.minY,cy);region.maxX=Math.max(region.maxX,cx);region.maxY=Math.max(region.maxY,cy);region.remaining++;}
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;const nx=cx+dx,ny=cy+dy,next=ny*size+nx;
    if(nx<1||ny<1||nx>=size-1||ny>=size-1||grid[next]||labels[next]||dx&&dy&&(grid[cy*size+nx]||grid[ny*size+cx]))continue;
    labels[next]=label;queue[tail++]=next;
   }
  }regions.set(label,region);
 }
 const sorted=[...units].sort((a,b)=>role(a)-role(b)||a.id-b.id),center=units.reduce((p,e)=>({x:p.x+e.x/units.length,y:p.y+e.y/units.length}),{x:0,y:0});
 const length=Math.hypot(destination.x-center.x,destination.y-center.y),forward=length>.01?{x:(destination.x-center.x)/length,y:(destination.y-center.y)/length}:{x:0,y:1},side={x:forward.y,y:-forward.x};
 const used=new Uint8Array(size*size);
 for(const formation of FORMATIONS){
  const group=sorted.filter(e=>(e.formation??'line')===formation);if(!group.length)continue;
  const lineWidth=Math.max(8,Math.ceil(Math.sqrt(group.length)*1.7));
  const columns=formation==='line'?Math.min(lineWidth,Math.max(...[0,1,2].map(r=>group.filter(e=>role(e)===r).length))):Math.ceil(Math.sqrt(group.length)),spacing=formation==='spread'?2.5:1.3;
  const rows=[0,1,2].flatMap(r=>{const members=group.filter(e=>role(e)===r);return Array.from({length:Math.ceil(members.length/columns)},(_,i)=>members.slice(i*columns,(i+1)*columns));});
  rows.forEach((row,r)=>row.forEach((e,c)=>{
   const ideal={x:destination.x+side.x*(c-(row.length-1)/2)*spacing+forward.x*((rows.length-1)/2-r)*spacing,y:destination.y+side.y*(c-(row.length-1)/2)*spacing+forward.y*((rows.length-1)/2-r)*spacing};
   const startX=Math.max(1,Math.min(size-2,Math.floor(e.x))),startY=Math.max(1,Math.min(size-2,Math.floor(e.y)));let component=labels[startY*size+startX];
   // Legacy saves can contain a unit under a moved/constructed footprint.
   if(!component)for(let radius=1;radius<=5&&!component;radius++)for(let dy=-radius;dy<=radius&&!component;dy++)for(let dx=-radius;dx<=radius&&!component;dx++){const x=startX+dx,y=startY+dy;if(x>0&&y>0&&x<size-1&&y<size-1)component=labels[y*size+x];}
   const region=regions.get(component);let best=-1,distance=Infinity;
   if(region?.remaining){
    // Clamp to this reachable region first: a wall or map edge should not make
    // every unit search the entire map. Expanding rings usually inspect only a
    // handful of cells; the worst case is still one bounded map per slot.
    const target={x:Math.max(region.minX+.5,Math.min(region.maxX+.5,ideal.x)),y:Math.max(region.minY+.5,Math.min(region.maxY+.5,ideal.y))},cx=Math.floor(target.x),cy=Math.floor(target.y);
    const consider=(x:number,y:number)=>{if(x<region.minX||y<region.minY||x>region.maxX||y>region.maxY)return;const id=y*size+x;if(labels[id]!==component||endpoint[id]||used[id])return;const d=(x+.5-target.x)**2+(y+.5-target.y)**2;if(d<distance||d===distance&&id<best){best=id;distance=d;}};
    for(let radius=0;radius<size;radius++){
     for(let dx=-radius;dx<=radius;dx++){consider(cx+dx,cy-radius);if(radius)consider(cx+dx,cy+radius);}
     for(let dy=-radius+1;dy<radius;dy++){consider(cx-radius,cy+dy);if(radius)consider(cx+radius,cy+dy);}
     if(best>=0&&distance<=(radius+.5)**2)break;
    }
   }
   if(best<0){result.set(e.id,{x:e.x,y:e.y});return;}
   used[best]=1;region!.remaining--;result.set(e.id,{x:best%size+.5,y:Math.floor(best/size)+.5});
  }));
 }
 return result;
}
