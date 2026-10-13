import {useEffect,useRef} from 'react';
import type {Position,Snapshot} from '../sim/types';
export function Minimap({snapshot:s,center}:{snapshot:Snapshot;center:(p:Position)=>void}){const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=ref.current!.getContext('2d')!,w=160,n=s.size,k=w/n;c.fillStyle='#23382c';c.fillRect(0,0,w,w);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const f=s.fog[y*n+x];if(f){c.fillStyle=f===2?'#758657':'#4b5c43';c.fillRect(x*k,y*k,k+1,k+1);}}
  for(const e of s.entities){if(e.owner>=0){c.fillStyle=s.players[e.owner].color;c.fillRect(e.x*k,e.y*k,e.kind==='building'?4:2,e.kind==='building'?4:2);}else if(e.kind==='resource'&&e.amount>0&&['gold','stone'].includes(e.type)){c.fillStyle=e.type==='gold'?'#dbc16c':'#b2b5a0';c.fillRect(e.x*k,e.y*k,2,2);}}
 },[s]);
 return <button className="minimap" aria-label="Navigate the map" onClick={e=>{const r=ref.current!.getBoundingClientRect();center({x:(e.clientX-r.left)/r.width*s.size,y:(e.clientY-r.top)/r.height*s.size});}}><canvas ref={ref} width={160} height={160}/><span>Ironvale</span></button>;
}
