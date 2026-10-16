import {PlaneGeometry} from 'three';
import type {Snapshot} from '../sim/types';
type Relief=Pick<Snapshot,'size'|'fog'|'elevation'>;
/** A real tile mesh, with the same diagonals as simulation height sampling. */
export function elevatedGeometry(s:Relief):PlaneGeometry{
 const g=new PlaneGeometry(s.size,s.size,s.size,s.size);updateElevation(g,s);return g;
}
export function updateElevation(g:PlaneGeometry,s:Relief):void{
 const p=g.getAttribute('position'),stride=s.size+1;
 for(let y=0;y<=s.size;y++)for(let x=0;x<=s.size;x++){
  let known=false;for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){const tx=x+dx,ty=y+dy;if(tx>=0&&ty>=0&&tx<s.size&&ty<s.size&&s.fog[ty*s.size+tx])known=true;}
  p.setZ(y*stride+x,known?s.elevation?.[y*stride+x]??0:0);
 }
 p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
}
