import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { entityTexture,tileTexture } from './art';
import type { Entity, Position, Snapshot, BuildingType } from '../sim/types';
import { BUILDINGS } from '../sim/definitions';
export const iso=(p:Position):Position=>({x:(p.x-p.y)*32,y:(p.x+p.y)*16});
export const uniso=(p:Position):Position=>({x:p.x/64+p.y/32,y:p.y/32-p.x/64});
export interface BattlefieldHooks { select:(ids:number[],append:boolean)=>void; action:(point:Position,target?:Entity)=>void; cancel:()=>void; error:(text:string)=>void }
export class Battlefield {
 app=new Application();world=new Container();ground=new Container();objects=new Container();overlay=new Graphics();labels=new Container();
 sprites=new Map<number,Sprite>();chunks=new Map<string,{sprite:Sprite;canvas:HTMLCanvasElement;fog:number[]}>();snapshot?:Snapshot;selection:number[]=[];placement?:BuildingType;mode='';camera={x:0,y:0};zoom=1;ready=false;destroyed=false;
 private resize?:ResizeObserver;private pointers=new Map<number,Position>();private drag?:{point:Position;last:Position;id:number;button:number;touch:boolean;hit?:Entity;shift:boolean;moved:boolean;pan:boolean};private pointer?:Position;private initialPinch=0;private initialZoom=1;private keys=new Set<string>();private lastTime=performance.now();private frameTimes:number[]=[];
 constructor(private host:HTMLElement,private hooks:BattlefieldHooks,private interactive=true){}
 async init():Promise<void>{
  await this.app.init({resizeTo:this.host,background:'#344b36',antialias:true,preference:'webgl',resolution:this.host.clientWidth<700?1:Math.min(devicePixelRatio,2),autoDensity:true});
  if(this.destroyed){this.app.destroy(true,{children:true});return;}
  this.host.appendChild(this.app.canvas);this.app.canvas.setAttribute('aria-label','Isometric battlefield');this.app.canvas.style.touchAction='none';
  this.world.addChild(this.ground,this.objects,this.overlay,this.labels);this.objects.sortableChildren=true;this.app.stage.addChild(this.world);
  this.ready=true;this.zoom=innerWidth<600?.92:1.1;
  this.resize=new ResizeObserver(()=>this.app.resize());this.resize.observe(this.host);
  const cv=this.app.canvas;
  cv.addEventListener('pointerdown',this.down);cv.addEventListener('pointermove',this.move);cv.addEventListener('pointerup',this.up);cv.addEventListener('pointercancel',this.cancelPointer);cv.addEventListener('contextmenu',this.context);cv.addEventListener('wheel',this.wheel,{passive:false});
  if(this.interactive){window.addEventListener('keydown',this.keydown);window.addEventListener('keyup',this.keyup);window.addEventListener('blur',this.blur);}
  this.app.ticker.add(()=>this.draw());if(this.snapshot)this.update(this.snapshot,true);
 }
 update(s:Snapshot,initial=false):void{
  const prior=this.snapshot;this.snapshot=s;if(!this.ready)return;
  if(!prior||prior.size!==s.size){for(const chunk of this.chunks.values())chunk.sprite.destroy({texture:true,textureSource:true});this.chunks.clear();initial=true;}
  if(initial){const cap=s.entities.find(e=>e.owner===s.playerId&&e.type==='capital');this.center(cap?{x:cap.x+1.5,y:cap.y+3}:{x:20,y:20});}
  this.updateTerrain(s);
  const alive=new Set<number>();
  for(const e of s.entities){if(e.kind==='resource'&&e.amount<=0)continue;alive.add(e.id);let sp=this.sprites.get(e.id);if(!sp){sp=new Sprite(entityTexture(e.type,e.owner));sp.anchor.set(.5,e.kind==='building'?.77:e.type==='wood'?.88:.85);this.sprites.set(e.id,sp);this.objects.addChild(sp);const p=this.entityPosition(e);sp.position.set(p.x,p.y);}
   const texture=entityTexture(e.type,e.owner);if(sp.texture!==texture)sp.texture=texture;sp.alpha=e.ghost?.45:e.progress<1?.55+.4*e.progress:1;sp.tint=e.hp<=0?0x6c675b:0xffffff;
  }
  for(const[id,sp]of this.sprites)if(!alive.has(id)){sp.destroy();this.sprites.delete(id);}
 }
 private terrainView='';
 private updateTerrain(s:Snapshot):void{
  const left=this.camera.x-this.app.screen.width/2/this.zoom-384,right=this.camera.x+this.app.screen.width/2/this.zoom+384,top=this.camera.y-this.originY()/this.zoom-192,bottom=this.camera.y+(this.app.screen.height-this.originY())/this.zoom+192;
  for(let cy=0;cy<s.size;cy+=8)for(let cx=0;cx<s.size;cx+=8){const pos=iso({x:cx,y:cy});if(pos.x+256<left||pos.x-256>right||pos.y+258<top||pos.y>bottom)continue;const key=`${cx},${cy}`,fog:number[]=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)fog.push(s.fog[(cy+y)*s.size+cx+x]);let chunk=this.chunks.get(key);if(!chunk&&!fog.some(v=>v>0))continue;if(chunk&&fog.every((v,i)=>chunk!.fog[i]===v))continue;
   if(!chunk){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=258;const sprite=new Sprite(Texture.from(canvas));sprite.anchor.set(.5,0);const p=iso({x:cx,y:cy});sprite.position.set(p.x,p.y);this.ground.addChild(sprite);chunk={sprite,canvas,fog:[]};this.chunks.set(key,chunk);}
   const ctx=chunk.canvas.getContext('2d')!;ctx.clearRect(0,0,512,258);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const f=fog[y*8+x];if(!f)continue;const v=s.terrain[(cy+y)*s.size+cx+x],source=tileTexture(v===1?4:((cx+x)*7+(cy+y)*13)%4,f===1).source.resource as HTMLCanvasElement;ctx.drawImage(source,256+(x-y)*32-32,(x+y)*16);}
   chunk.fog=fog;chunk.sprite.texture.source.update();
  }
 }
 private entityPosition(e:Entity):Position {const n=e.kind==='building'?BUILDINGS[e.type as keyof typeof BUILDINGS].size:0;return iso({x:e.x+n*.5,y:e.y+n*.5});}
 center(p:Position):void{this.camera=iso(p);}
 private originY():number{return this.app.screen.height*(this.interactive?(this.app.screen.width<700?.35:.42):.5);}
 private screenPoint(e:PointerEvent|WheelEvent):Position {const r=this.app.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
 screenToWorld(p:Position):Position {return uniso({x:(p.x-this.app.screen.width/2)/this.zoom+this.camera.x,y:(p.y-this.originY())/this.zoom+this.camera.y});}
 worldToScreen(p:Position):Position {const v=iso(p);return{x:(v.x-this.camera.x)*this.zoom+this.app.screen.width/2,y:(v.y-this.camera.y)*this.zoom+this.originY()};}
 private hit(p:Position):Entity|undefined{
  if(!this.snapshot)return;const candidates=this.snapshot.entities.filter(e=>!e.ghost&&!(e.kind==='resource'&&e.amount<=0)).map(e=>{const pos=this.entityPosition(e),sp={x:(pos.x-this.camera.x)*this.zoom+this.app.screen.width/2,y:(pos.y-this.camera.y)*this.zoom+this.originY()};const width=e.kind==='building'?BUILDINGS[e.type as keyof typeof BUILDINGS].size*30*this.zoom:e.type==='wood'?30*this.zoom:21*this.zoom;const h=e.kind==='building'?100*this.zoom:e.kind==='unit'?42*this.zoom:e.type==='wood'?95*this.zoom:26*this.zoom;return {e,sp,width,h};}).filter(v=>Math.abs(p.x-v.sp.x)<v.width&&p.y>v.sp.y-v.h&&p.y<v.sp.y+14*this.zoom).sort((a,b)=>(a.e.kind==='unit'?-10000:0)+Math.abs(a.sp.x-p.x)+Math.abs(a.sp.y-15-p.y)-((b.e.kind==='unit'?-10000:0)+Math.abs(b.sp.x-p.x)+Math.abs(b.sp.y-15-p.y)));
  return candidates[0]?.e;
 }
 private down=(e:PointerEvent)=>{if(!this.interactive)return;const p=this.screenPoint(e);this.pointers.set(e.pointerId,p);this.app.canvas.setPointerCapture(e.pointerId);
  if(this.pointers.size===2){const a=[...this.pointers.values()];this.initialPinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);this.initialZoom=this.zoom;this.drag=undefined;return;}
  this.drag={point:p,last:p,id:e.pointerId,button:e.button,touch:e.pointerType!=='mouse',hit:this.hit(p),shift:e.shiftKey,moved:false,pan:e.button===1||(e.button===0&&e.ctrlKey)||e.pointerType!=='mouse'};
 };
 private move=(e:PointerEvent)=>{const p=this.screenPoint(e);this.pointer=p;if(this.pointers.has(e.pointerId))this.pointers.set(e.pointerId,p);
  if(this.pointers.size===2){const a=[...this.pointers.values()];this.zoom=Math.max(.4,Math.min(2,this.initialZoom*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/this.initialPinch));return;}
  const d=this.drag;if(!d||d.id!==e.pointerId)return;const delta=Math.hypot(p.x-d.point.x,p.y-d.point.y);if(delta>8)d.moved=true;if(d.moved&&d.pan){this.camera.x-=(p.x-d.last.x)/this.zoom;this.camera.y-=(p.y-d.last.y)/this.zoom;}d.last=p;
 };
 private up=(e:PointerEvent)=>{const p=this.screenPoint(e),d=this.drag;this.pointers.delete(e.pointerId);if(this.pointers.size>0){this.drag=undefined;return;}this.drag=undefined;if(!d)return;
  if(d.moved){if(!d.pan&&d.button===0&&this.snapshot){const ids=this.snapshot.entities.filter(v=>v.owner===this.snapshot!.playerId&&v.kind==='unit').filter(v=>{const q=this.worldToScreen(v);return q.x>=Math.min(d.point.x,p.x)&&q.x<=Math.max(d.point.x,p.x)&&q.y>=Math.min(d.point.y,p.y)&&q.y<=Math.max(d.point.y,p.y);}).map(v=>v.id);this.hooks.select(ids,d.shift);}return;}
  if(d.pan&&!d.touch)return;
  const world=this.screenToWorld(p),target=this.hit(p);
  if(d.button===2||this.mode||this.placement){this.hooks.action(world,target);return;}
  if(target)this.hooks.select([target.id],d.shift||d.touch&&this.selection.includes(target.id));else this.hooks.select([],false);
 };
 private cancelPointer=(e:PointerEvent)=>{this.pointers.delete(e.pointerId);this.drag=undefined;};
 private context=(e:Event)=>e.preventDefault();
 private wheel=(e:WheelEvent)=>{if(!this.interactive)return;e.preventDefault();const p=this.screenPoint(e),before=this.screenToWorld(p);this.zoom=Math.max(.4,Math.min(2,this.zoom*Math.exp(-e.deltaY*.001)));const after=this.screenToWorld(p),a=iso(before),b=iso(after);this.camera.x+=a.x-b.x;this.camera.y+=a.y-b.y;};
 private keydown=(e:KeyboardEvent)=>{if(!(e.target instanceof HTMLInputElement)&&!e.ctrlKey&&!e.metaKey)this.keys.add(e.code);if(e.code.startsWith('Arrow'))e.preventDefault();};
 private keyup=(e:KeyboardEvent)=>this.keys.delete(e.code);
 private blur=()=>{this.keys.clear();this.drag=undefined;this.pointers.clear();};
 private draw():void{
  if(!this.snapshot)return;const now=performance.now(),dt=Math.min(.05,(now-this.lastTime)/1000);this.frameTimes.push(now-this.lastTime);if(this.frameTimes.length>120)this.frameTimes.shift();this.lastTime=now;
  if(this.interactive){const speed=600*dt/this.zoom;this.camera.x+=(this.keys.has('ArrowRight')?speed:0)-(this.keys.has('ArrowLeft')?speed:0);this.camera.y+=(this.keys.has('ArrowDown')?speed:0)-(this.keys.has('ArrowUp')?speed:0);}
  const clamp=uniso(this.camera);clamp.x=Math.max(0,Math.min(this.snapshot.size,clamp.x));clamp.y=Math.max(0,Math.min(this.snapshot.size,clamp.y));this.camera=iso(clamp);
  const viewStamp=`${Math.floor(this.camera.x/128)},${Math.floor(this.camera.y/64)},${this.zoom.toFixed(2)},${this.app.screen.width},${this.app.screen.height}`;if(viewStamp!==this.terrainView){this.terrainView=viewStamp;this.updateTerrain(this.snapshot);}
  this.world.position.set(this.app.screen.width/2-this.camera.x*this.zoom,this.originY()-this.camera.y*this.zoom);this.world.scale.set(this.zoom);
  const left=-this.world.x/this.zoom-64,right=(this.app.screen.width-this.world.x)/this.zoom+64,top=-this.world.y/this.zoom-64,bottom=(this.app.screen.height-this.world.y)/this.zoom+64;
  for(const chunk of this.chunks.values()){const t=chunk.sprite;t.visible=t.x+256>left&&t.x-256<right&&t.y+258>top&&t.y<bottom;}
  this.overlay.clear();
  for(const e of this.snapshot.entities){const sp=this.sprites.get(e.id);if(!sp)continue;const pos=this.entityPosition(e);const moving=e.kind==='unit'&&Math.hypot(sp.x-pos.x,sp.y-pos.y)>.3;
   const factor=1-Math.exp(-dt*12);sp.x+=(pos.x-sp.x)*factor;sp.y+=(pos.y-sp.y)*factor;sp.zIndex=e.x+e.y+(e.kind==='building'?BUILDINGS[e.type as keyof typeof BUILDINGS].size:0);
   const working=e.kind==='unit'&&['gather','build','repair'].includes(e.order.kind);
   const bob=(moving||working)&&e.kind==='unit'?Math.sin(now*.013+e.id)*1.5:0;sp.pivot.y=bob;sp.rotation=working?Math.sin(now*.009+e.id)*.025:0;
   sp.visible=sp.x>-this.world.x/this.zoom-350&&sp.x<(this.app.screen.width-this.world.x)/this.zoom+350&&sp.y>-this.world.y/this.zoom-300&&sp.y<(this.app.screen.height-this.world.y)/this.zoom+200;
   if(!sp.visible)continue;
   if(this.selection.includes(e.id)){
    const n=e.kind==='building'?BUILDINGS[e.type as keyof typeof BUILDINGS].size*22:16;
    this.overlay.ellipse(pos.x,pos.y+2,n,n*.45).stroke({color:e.owner===this.snapshot.playerId?0xe9d797:0xe79c80,width:2});
    const yy=pos.y-(e.kind==='building'?110:55),width=e.kind==='building'?65:32;
    this.overlay.rect(pos.x-width/2,yy,width,4).fill(0x26332b);this.overlay.rect(pos.x-width/2,yy,width*Math.max(0,e.hp/e.maxHp),4).fill(e.owner===this.snapshot.playerId?0xa9c782:0xd58a72);
   }
   if(e.kind==='building'&&e.progress<1){this.overlay.rect(pos.x-22,pos.y-35,44,4).fill(0x4b4635);this.overlay.rect(pos.x-22,pos.y-35,44*e.progress,4).fill(0xe0c985);const n=BUILDINGS[e.type as keyof typeof BUILDINGS].size*18;this.overlay.moveTo(pos.x-n,pos.y-10).lineTo(pos.x-n,pos.y-80).lineTo(pos.x+n,pos.y-50).lineTo(pos.x+n,pos.y+10).stroke({color:0x9b8053,width:3,alpha:.8});}
   if(e.occupation){this.overlay.rect(pos.x-40,pos.y-60,80,7).fill(0x403929);this.overlay.rect(pos.x-40,pos.y-60,80*e.occupation.progress/30,7).fill(0xe6b86f);}
   if(e.kind==='unit'&&e.carry&&e.owner===this.snapshot.playerId)this.overlay.circle(pos.x+8,pos.y-28,3).fill(e.carry.resource==='gold'?0xd7bd61:e.carry.resource==='food'?0xcc9b69:0xb5a58b);
   if(e.attackFx&&this.snapshot.tick-e.attackFx.tick<20){const end=iso(e.attackFx),age=(this.snapshot.tick-e.attackFx.tick)/20;const ranged=['archer','trebuchet','tower','fortress','capital'].includes(e.type);if(ranged){const x=pos.x+(end.x-pos.x)*age,y=pos.y-35+(end.y-pos.y+35)*age-Math.sin(age*Math.PI)*25;this.overlay.moveTo(x-6,y-2).lineTo(x,y).stroke({color:e.type==='trebuchet'?0x57564b:0xe5d3a4,width:e.type==='trebuchet'?5:2});}else if(age<.4){this.overlay.moveTo(pos.x+8,pos.y-18).lineTo(pos.x+23*Math.sin(age*8),pos.y-40+age*40).stroke({color:0xe5d8b9,width:2});}}
  }
  if(this.placement&&this.pointer){const p=this.screenToWorld(this.pointer),point={x:Math.floor(p.x),y:Math.floor(p.y)},d=BUILDINGS[this.placement],s=this.snapshot;
   const valid=point.x>0&&point.y>0&&point.x+d.size<s.size&&point.y+d.size<s.size&&s.fog[point.y*s.size+point.x]===2&&!s.entities.some(e=>e.kind==='building'&&point.x<e.x+BUILDINGS[e.type as keyof typeof BUILDINGS].size&&point.x+d.size>e.x&&point.y<e.y+BUILDINGS[e.type as keyof typeof BUILDINGS].size&&point.y+d.size>e.y||e.kind==='resource'&&e.amount>0&&e.x>=point.x&&e.x<point.x+d.size&&e.y>=point.y&&e.y<point.y+d.size);
   const corners=[point,{x:point.x+d.size,y:point.y},{x:point.x+d.size,y:point.y+d.size},{x:point.x,y:point.y+d.size}].map(iso);
   this.overlay.poly(corners.flatMap(q=>[q.x,q.y])).fill({color:valid?0x99bc80:0xd98169,alpha:.35}).stroke({color:valid?0xc8daa4:0xffb19b,width:2});
  }
  const drag=this.drag;if(drag?.moved&&!drag.pan&&drag.button===0){const a=this.screenToWorld(drag.point),b=this.screenToWorld(drag.last),pa=iso(a),pb=iso(b);this.overlay.rect(Math.min(pa.x,pb.x),Math.min(pa.y,pb.y),Math.abs(pb.x-pa.x),Math.abs(pb.y-pa.y)).fill({color:0xcadd9e,alpha:.12}).stroke({color:0xd9e8b6,width:1});}
 }
 metrics():{fps:number;renderer:string}{return {fps:1000/(this.frameTimes.reduce((a,b)=>a+b,0)/Math.max(1,this.frameTimes.length)),renderer:'WebGL'};}
 destroy():void{this.destroyed=true;this.resize?.disconnect();window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);if(this.ready){this.app.ticker.stop();for(const chunk of this.chunks.values())chunk.sprite.destroy({texture:true,textureSource:true});this.chunks.clear();this.app.destroy(true,{children:true,texture:false});}this.sprites.clear();}
}
