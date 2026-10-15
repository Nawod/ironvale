import type {Entity,Snapshot} from '../sim/types';
import {BUILDINGS} from '../sim/definitions';

/** Cosmetic paths use only entities already present in the player's snapshot. */
export function settlementSurfaceMask(size:number,entities:Entity[],detail=4):Uint8Array{
 const width=size*detail,mask=new Uint8Array(width*width);
 const buildings=entities.filter(e=>e.kind==='building'&&e.hp>0&&!['wall','palisade','gate','farm'].includes(e.type));
 const stamp=(x:number,y:number,radius:number,strength:number)=>{
  for(let py=Math.max(0,Math.floor((y-radius)*detail));py<Math.min(width,Math.ceil((y+radius)*detail));py++)for(let px=Math.max(0,Math.floor((x-radius)*detail));px<Math.min(width,Math.ceil((x+radius)*detail));px++){
   const distance=Math.hypot((px+.5)/detail-x,(py+.5)/detail-y),value=Math.round(strength*Math.max(0,Math.min(1,(radius-distance)*2)));
   const i=py*width+px;mask[i]=Math.max(mask[i],value);
  }
 };
 for(const b of buildings){
  const n=BUILDINGS[b.type as keyof typeof BUILDINGS].size,cx=b.x+n/2,cy=b.y+n/2;
  for(let y=Math.max(0,Math.floor((b.y-.25)*detail));y<Math.min(width,Math.ceil((b.y+n+.4)*detail));y++)for(let x=Math.max(0,Math.floor((b.x-.25)*detail));x<Math.min(width,Math.ceil((b.x+n+.25)*detail));x++)mask[y*width+x]=255;
  stamp(cx,cy+n/2+.35,1.35,240);
  const neighbour=buildings.filter(a=>a.owner===b.owner&&a.id<b.id).map(a=>({a,n:BUILDINGS[a.type as keyof typeof BUILDINGS].size})).map(({a,n})=>({x:a.x+n/2,y:a.y+n+.25,d:Math.hypot(a.x+n/2-cx,a.y+n+.25-(b.y+n+.25))})).filter(a=>a.d<15).sort((a,b)=>a.d-b.d)[0];
  if(neighbour){const from={x:cx,y:b.y+n+.25},steps=Math.ceil(neighbour.d*detail);for(let i=0;i<=steps;i++){const t=i/Math.max(1,steps);stamp(from.x+(neighbour.x-from.x)*t,from.y+(neighbour.y-from.y)*t,.65,225);}}
 }
 return mask;
}
/** Plane UVs start at the southern edge; simulation rows start at the north. */
export function terrainPixels(s:Pick<Snapshot,'size'|'terrain'|'fog'>,data:Uint8Array=new Uint8Array(s.size*s.size*4)):Uint8Array {
 for(let i=0;i<s.fog.length;i++){
  const f=s.fog[i],x=i%s.size,y=Math.floor(i/s.size),variant=(x*7+y*13)%4,dim=f===1?.42:1;
  const color=f===0?[22,37,30]:s.terrain[i]===1?[143,133,94]:[91+variant*4,119+variant*3,74+variant*3];
  const dest=((s.size-1-y)*s.size+x)*4;
  for(let c=0;c<3;c++)data[dest+c]=color[c]*dim;data[dest+3]=255;
 }
 return data;
}
/** Sub-tile detail preserves the fog boundary: no surface from an unseen tile is sampled. */
export function terrainSurfacePixels(s:Pick<Snapshot,'size'|'terrain'|'fog'>,data:Uint8Array,detail=4,settlement?:Uint8Array):Uint8Array{
 const width=s.size*detail;
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const tx=Math.floor(x/detail),ty=Math.floor(y/detail),i=ty*s.size+tx,f=s.fog[i],dest=((width-1-y)*width+x)*4;
  if(!f){data[dest]=22;data[dest+1]=37;data[dest+2]=30;data[dest+3]=255;continue;}
  const noise=((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%255/255,wide=Math.sin(x*.13)*Math.cos(y*.11),dim=f===1?.42:1;
  let soil=0,samples=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=tx+dx,ny=ty+dy,index=ny*s.size+nx;if(nx>=0&&ny>=0&&nx<s.size&&ny<s.size&&s.fog[index]){soil+=s.terrain[index]===1?1:0;samples++;}}
  const yard=(settlement?.[y*width+x]??0)/255,blend=Math.max(yard*.94,Math.max(0,.09+.65*soil/Math.max(1,samples)+.13*wide));
  const grass=[111,127,70],earth=[164,141,103];for(let c=0;c<3;c++)data[dest+c]=Math.max(0,(grass[c]*(1-blend)+earth[c]*blend+(noise-.5)*20)*dim);data[dest+3]=255;
 }
 return data;
}
