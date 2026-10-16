import {useEffect,useRef} from 'react';
import type {Position,Snapshot} from '../sim/types';
import {harvestedResource} from '../sim/nature';
import {COLORS} from '../sim/definitions';
import {TERRAIN} from '../sim/terrain';
export function Minimap({snapshot:s,center}:{snapshot:Snapshot;center:(p:Position)=>void}){const ref=useRef<HTMLCanvasElement>(null),terrain=useRef<HTMLCanvasElement|undefined>(undefined);
 useEffect(()=>{const c=ref.current!.getContext('2d')!,w=160,n=s.size,k=w/n;if(!terrain.current)terrain.current=document.createElement('canvas');const tile=terrain.current;tile.width=n;tile.height=n;const tc=tile.getContext('2d')!,image=tc.createImageData(n,n);
  for(let i=0;i<s.fog.length;i++){const t=s.terrain[i],known=s.fog[i]>0,dim=s.fog[i]===1?.55:1,color=!known?[35,56,44]:t===TERRAIN.water?[44,114,143]:t===TERRAIN.ford?[105,156,155]:t===TERRAIN.bridge?[201,180,135]:[117,134,87];image.data[i*4]=color[0]*dim;image.data[i*4+1]=color[1]*dim;image.data[i*4+2]=color[2]*dim;image.data[i*4+3]=255;}tc.putImageData(image,0,0);c.imageSmoothingEnabled=false;c.drawImage(tile,0,0,w,w);
  for(const e of s.entities){if(e.owner>=0){c.fillStyle=COLORS[e.owner%COLORS.length];c.fillRect(e.x*k,e.y*k,e.kind==='building'?4:2,e.kind==='building'?4:2);}else if(e.type==='zombie'&&e.hp>0&&!e.ghost){c.fillStyle='#d0e987';c.fillRect(e.x*k,e.y*k,3,3);}else if(e.kind==='resource'&&e.amount>0&&['gold','stone','food'].includes(harvestedResource(e)??'')){c.fillStyle=e.type==='gold'?'#dbc16c':harvestedResource(e)==='food'?'#9dbb6c':'#b2b5a0';c.fillRect(e.x*k,e.y*k,2,2);}}
 },[s]);
 return <button className="minimap" aria-label="Navigate the map" onClick={e=>{const r=ref.current!.getBoundingClientRect();center({x:(e.clientX-r.left)/r.width*s.size,y:(e.clientY-r.top)/r.height*s.size});}}><canvas ref={ref} width={160} height={160}/><span>Ironvale</span></button>;
}
