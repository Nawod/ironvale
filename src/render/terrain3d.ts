import type {Snapshot} from '../sim/types';
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
export function terrainSurfacePixels(s:Pick<Snapshot,'size'|'terrain'|'fog'>,data:Uint8Array,detail=4):Uint8Array{
 const width=s.size*detail;
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const tx=Math.floor(x/detail),ty=Math.floor(y/detail),i=ty*s.size+tx,f=s.fog[i],dest=((width-1-y)*width+x)*4;
  if(!f){data[dest]=22;data[dest+1]=37;data[dest+2]=30;data[dest+3]=255;continue;}
  const noise=((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%255/255,wide=Math.sin(x*.13)*Math.cos(y*.11),dim=f===1?.42:1;
  let soil=0,samples=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=tx+dx,ny=ty+dy,index=ny*s.size+nx;if(nx>=0&&ny>=0&&nx<s.size&&ny<s.size&&s.fog[index]){soil+=s.terrain[index]===1?1:0;samples++;}}const blend=.07+.72*soil/Math.max(1,samples)+.06*wide;
  const grass=[83,112,64],earth=[141,125,88];for(let c=0;c<3;c++)data[dest+c]=Math.max(0,(grass[c]*(1-blend)+earth[c]*blend+(noise-.5)*17)*dim);data[dest+3]=255;
 }
 return data;
}
