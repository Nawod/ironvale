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
