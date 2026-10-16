import {useEffect,useRef} from 'react';
import type {Position,Snapshot} from '../sim/types';
import {harvestedResource} from '../sim/nature';
import {COLORS} from '../sim/definitions';
import {TERRAIN} from '../sim/terrain';
import {clipMapViewport} from '../render/minimap-viewport';

export function Minimap({snapshot:s,center,viewport}:{snapshot:Snapshot;center:(p:Position)=>void;viewport?:()=>readonly Position[]|undefined}){
 const ref=useRef<HTMLCanvasElement>(null),background=useRef<HTMLCanvasElement|undefined>(undefined),latest=useRef({s,viewport});latest.current={s,viewport};
 useEffect(()=>{
  if(!background.current)background.current=document.createElement('canvas');const tile=background.current;tile.width=tile.height=160;const c=tile.getContext('2d')!,n=s.size,k=160/n,image=c.createImageData(n,n);
  for(let i=0;i<s.fog.length;i++){
   const t=s.terrain[i],known=s.fog[i]>0,dim=s.fog[i]===1?.55:1,color=!known?[31,43,32]:t===TERRAIN.water?[47,110,136]:t===TERRAIN.ford?[118,156,144]:t===TERRAIN.bridge?[209,182,126]:t===TERRAIN.woodland?[92,117,66]:[137,143,92];
   image.data[i*4]=color[0]*dim;image.data[i*4+1]=color[1]*dim;image.data[i*4+2]=color[2]*dim;image.data[i*4+3]=255;
  }
  const pixels=document.createElement('canvas');pixels.width=pixels.height=n;pixels.getContext('2d')!.putImageData(image,0,0);c.imageSmoothingEnabled=false;c.drawImage(pixels,0,0,160,160);
  for(const e of s.entities){
   if(e.owner>=0){const size=e.type==='capital'?5:e.kind==='building'?3:2;c.fillStyle='#161d17';c.fillRect(e.x*k+1,e.y*k+1,size,size);c.fillStyle=e.hp<=0?'#9b927b':COLORS[e.owner%COLORS.length];c.fillRect(e.x*k,e.y*k,size,size);if(e.type==='capital'){c.strokeStyle='#e7d8ae';c.lineWidth=.6;c.strokeRect(e.x*k,e.y*k,size,size);}}
   else if(e.type==='zombie'&&e.hp>0&&!e.ghost){c.fillStyle='#d0e987';c.fillRect(e.x*k,e.y*k,3,3);}
   else if(e.kind==='resource'&&e.amount>0&&['gold','stone','food'].includes(harvestedResource(e)??'')){c.fillStyle=e.type==='gold'?'#dbc16c':harvestedResource(e)==='food'?'#a6bd71':'#bdc0ab';c.fillRect(e.x*k,e.y*k,2,2);}
  }
 },[s]);
 useEffect(()=>{
  const draw=()=>{const canvas=ref.current;if(document.hidden||!canvas?.getClientRects().length)return;const c=canvas.getContext('2d');if(c&&background.current){c.clearRect(0,0,160,160);c.drawImage(background.current,0,0);const{ s,viewport}=latest.current,points=clipMapViewport(viewport?.()??[],s.size);canvas.dataset.cameraView=points.length?'visible':'empty';if(points.length){c.beginPath();for(const[i,p]of points.entries()){const x=p.x/s.size*160,y=p.y/s.size*160;if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.closePath();c.strokeStyle='#1a211b';c.lineWidth=3;c.stroke();c.strokeStyle='#fff0bf';c.lineWidth=1.25;c.stroke();}}};
  draw();const timer=setInterval(draw,100);return()=>clearInterval(timer);
 },[]);
 return <button className="minimap" aria-label="Navigate the map" title="Click or tap to navigate. Enter returns to your city." onClick={e=>{
  if(e.detail===0){const cap=s.entities.find(entity=>entity.id===s.players[s.playerId].capital);center(cap?{x:cap.x+1.5,y:cap.y+1.5}:{x:s.size/2,y:s.size/2});return;}
  const r=ref.current!.getBoundingClientRect();center({x:Math.max(0,Math.min(s.size,(e.clientX-r.left)/r.width*s.size)),y:Math.max(0,Math.min(s.size,(e.clientY-r.top)/r.height*s.size))});
 }}><canvas ref={ref} width={160} height={160}/><span>Ironvale</span><i className="minimap-north" aria-hidden="true">N</i></button>;
}
