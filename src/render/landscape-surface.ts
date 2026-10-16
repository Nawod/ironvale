import type {Snapshot,Entity} from '../sim/types';
import {BUILDINGS} from '../sim/definitions';
import {settlementSurfaceMask} from './terrain3d';
export interface LandscapeFields {size:number;detail:number;moisture:Float32Array;woodland:Uint8Array;rock:Uint8Array;paving:Uint8Array}
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const hash=(x:number,y:number,seed:number)=>((Math.imul(x+19,374761393)^Math.imul(y+37,668265263)^Math.imul(seed,1274126177))>>>0)/4294967295;
function noise(x:number,y:number,seed:number):number{
 const ix=Math.floor(x),iy=Math.floor(y),sx=x-ix,sy=y-iy,fx=sx*sx*(3-2*sx),fy=sy*sy*(3-2*sy);
 return mix(mix(hash(ix,iy,seed),hash(ix+1,iy,seed),fx),mix(hash(ix,iy+1,seed),hash(ix+1,iy+1,seed),fx),fy);
}
/** Public seed supplies climate variation; entity/terrain influence uses known cells only. */
export function createLandscapeFields(s:Pick<Snapshot,'size'|'fog'|'terrain'|'entities'|'players'|'config'>,detail=4):LandscapeFields{
 const width=s.size*detail,woodland=new Uint8Array(width*width),rock=new Uint8Array(width*width),moisture=new Float32Array((s.size+1)**2);
 for(let y=0;y<=s.size;y++)for(let x=0;x<=s.size;x++)moisture[y*(s.size+1)+x]=noise(x*.14,y*.14,s.config.seed)*.64+noise(x*.041,y*.041,s.config.seed+17)*.36;
 const known=(x:number,y:number)=>x>=0&&y>=0&&x<s.size&&y<s.size&&s.fog[Math.floor(y)*s.size+Math.floor(x)]>0;
 const knownEntity=(e:Entity)=>{
  const n=e.kind==='building'?BUILDINGS[e.type as keyof typeof BUILDINGS].size:1;
  for(let y=Math.floor(e.y);y<e.y+n;y++)for(let x=Math.floor(e.x);x<e.x+n;x++)if(known(x,y))return true;return false;
 };
 const buildings=s.entities.filter(e=>e.kind==='building'&&e.hp>0&&knownEntity(e)&&(e.visualAge??s.players[e.owner]?.age??1)>=2);
 const paving=settlementSurfaceMask(s.size,buildings,detail);
 const stamp=(mask:Uint8Array,cx:number,cy:number,radius:number)=>{
  for(let y=Math.max(0,Math.floor((cy-radius)*detail));y<Math.min(width,Math.ceil((cy+radius)*detail));y++)for(let x=Math.max(0,Math.floor((cx-radius)*detail));x<Math.min(width,Math.ceil((cx+radius)*detail));x++){
   if(!known(x/detail,y/detail)||s.terrain[Math.floor(y/detail)*s.size+Math.floor(x/detail)]>=3)continue;
   const value=Math.round(Math.max(0,1-Math.hypot((x+.5)/detail-cx,(y+.5)/detail-cy)/radius)*255);mask[y*width+x]=Math.max(mask[y*width+x],value);
  }
 };
 for(const e of s.entities)if(e.kind==='resource'&&e.amount>0&&knownEntity(e)){
  if(e.type==='wood')stamp(woodland,e.x,e.y,2.2);else if(e.type==='stone'||e.type==='gold')stamp(rock,e.x,e.y,1.4);
 }
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const tile=Math.floor(y/detail)*s.size+Math.floor(x/detail),i=y*width+x;
  if(!s.fog[tile]||s.terrain[tile]>=3){woodland[i]=rock[i]=paving[i]=0;continue;}
  if(s.terrain[tile]===2)woodland[i]=Math.max(woodland[i],115);
 }
 return{size:s.size,detail,moisture,woodland,rock,paving};
}
/** UV orientation matches the ground plane; unknown style data is always zero. */
export function landscapeStylePixels(s:Pick<Snapshot,'size'|'fog'>,fields:LandscapeFields,data:Uint8Array=new Uint8Array(fields.paving.length*4)):Uint8Array{
 const width=s.size*fields.detail;
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const i=y*width+x,d=((width-1-y)*width+x)*4,known=s.fog[Math.floor(y/fields.detail)*s.size+Math.floor(x/fields.detail)]>0;
  data[d]=known?fields.paving[i]:0;data[d+1]=known?fields.woodland[i]:0;data[d+2]=known?fields.rock[i]:0;data[d+3]=255;
 }return data;
}
