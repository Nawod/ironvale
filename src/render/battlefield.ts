import {Scene,WebGLRenderer,HemisphereLight,DirectionalLight,Color,DataTexture,RGBAFormat,SRGBColorSpace,NearestFilter,PlaneGeometry,BoxGeometry,Mesh,MeshStandardMaterial,MeshBasicMaterial,Object3D,Raycaster,Vector2,RingGeometry,SphereGeometry,Group,PCFShadowMap} from 'three';
import type {Entity,Position,Snapshot,BuildingType} from '../sim/types';
import {BUILDINGS} from '../sim/definitions';
import {RTSCamera} from './camera3d';
import {ModelLibrary} from './models3d';
import {ModelBatches} from './batches3d';
import {terrainPixels} from './terrain3d';
export const iso=(p:Position):Position=>({x:(p.x-p.y)*32,y:(p.x+p.y)*16});
export const uniso=(p:Position):Position=>({x:p.x/64+p.y/32,y:p.y/32-p.x/64});
export interface BattlefieldHooks {select:(ids:number[],append:boolean)=>void;action:(point:Position,target?:Entity)=>void;cancel:()=>void;error:(text:string)=>void}
export class Battlefield {
 app={canvas:undefined as unknown as HTMLCanvasElement,screen:{width:1,height:1}};
 snapshot?:Snapshot;selection:number[]=[];placement?:BuildingType;mode='';camera={x:0,y:0};zoom=1;ready=false;destroyed=false;
 private yaw=Math.PI/4;private scene=new Scene();private view=new RTSCamera();private renderer?:WebGLRenderer;private models=new ModelLibrary();private batches=new ModelBatches(this.scene);private ray=new Raycaster();private root=new Object3D();
 private terrain?:Mesh<PlaneGeometry,MeshStandardMaterial>;private texture?:DataTexture;private terrainSize=0;private sun?:DirectionalLight;private raf=0;private selectionBox?:HTMLDivElement;
 private poses=new Map<number,{x:number;y:number;heading:number;seenAt:number}>();private indicators=new Group();private indicatorPool:Mesh[]=[];private indicatorCount=0;
 private ring=new RingGeometry(.8,1,24);private bar=new PlaneGeometry(1,1);private barMaterials=[new MeshBasicMaterial({color:0x27352c,depthTest:false}),new MeshBasicMaterial({color:0xb8d491,depthTest:false}),new MeshBasicMaterial({color:0xe2a17b,depthTest:false})];
 private preview=new Mesh(new BoxGeometry(1,.14,1),new MeshBasicMaterial({color:0xb8d491,transparent:true,opacity:.5,depthWrite:false}));private projectiles:Mesh[]=[];private projectileGeometry=new SphereGeometry(.08,6,4);private projectileMaterial=new MeshStandardMaterial({color:0xd4bc81});
 private holdTimer?:ReturnType<typeof setTimeout>;private clearHold=()=>{if(this.holdTimer!==undefined)clearTimeout(this.holdTimer);this.holdTimer=undefined;};
 private resize?:ResizeObserver;private pointers=new Map<number,Position>();private drag?:{point:Position;last:Position;id:number;button:number;touch:boolean;hit?:Entity;shift:boolean;moved:boolean;pan:boolean;held?:boolean;rotate?:boolean};private pointer?:Position;private initialPinch=0;private initialZoom=1;private initialAngle=0;private initialYaw=Math.PI/4;private keys=new Set<string>();private lastTime=performance.now();private frameTimes:number[]=[];
 constructor(private host:HTMLElement,private hooks:BattlefieldHooks,private interactive=true){}
 async init():Promise<void>{
  if(this.destroyed)return;this.renderer=new WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(this.host.clientWidth<700?1:Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=this.host.clientWidth>=700;this.renderer.shadowMap.type=PCFShadowMap;this.scene.background=new Color('#192b24');
  this.app.canvas=this.renderer.domElement;this.app.canvas.setAttribute('aria-label','3D battlefield');this.app.canvas.style.touchAction='none';this.host.appendChild(this.app.canvas);
  this.scene.add(new HemisphereLight('#f0e4c1','#496949',2.2));this.sun=new DirectionalLight('#fff2d1',2.8);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-28;this.sun.shadow.camera.right=28;this.sun.shadow.camera.top=28;this.sun.shadow.camera.bottom=-28;this.sun.shadow.camera.near=.1;this.sun.shadow.camera.far=120;this.sun.shadow.bias=-.001;this.scene.add(this.sun,this.sun.target,this.indicators,this.preview);this.preview.visible=false;
  this.selectionBox=document.createElement('div');this.selectionBox.className='selection-box';this.host.appendChild(this.selectionBox);
  this.ready=true;this.zoom=innerWidth<600?.92:1.1;this.resize=new ResizeObserver(()=>this.resizeView());this.resize.observe(this.host);this.resizeView();
  const cv=this.app.canvas;cv.addEventListener('pointerdown',this.down);cv.addEventListener('pointermove',this.move);cv.addEventListener('pointerup',this.up);cv.addEventListener('pointercancel',this.cancelPointer);cv.addEventListener('contextmenu',this.context);cv.addEventListener('wheel',this.wheel,{passive:false});
  if(this.interactive){window.addEventListener('keydown',this.keydown);window.addEventListener('keyup',this.keyup);window.addEventListener('blur',this.blur);}if(this.snapshot)this.update(this.snapshot,true);this.lastTime=performance.now();this.loop();
 }
 private resizeView():void{this.app.screen={width:Math.max(1,this.host.clientWidth),height:Math.max(1,this.host.clientHeight)};this.renderer?.setSize(this.app.screen.width,this.app.screen.height);this.configureCamera();}
 private configureCamera():void{this.view.configure({width:this.app.screen.width,height:this.app.screen.height,focus:uniso(this.camera),zoom:this.zoom,yaw:this.yaw,origin:this.interactive?(this.app.screen.width<700?.35:.42):.5});}
 update(s:Snapshot,initial=false):void{const prior=this.snapshot;this.snapshot=s;if(!this.ready)return;if(!prior||prior.size!==s.size)initial=true;if(initial){const cap=s.entities.find(e=>e.owner===s.playerId&&e.type==='capital');this.center(cap?{x:cap.x+1.5,y:cap.y+3}:{x:20,y:20});}this.updateTerrain(s);const ids=new Set(s.entities.map(e=>e.id));for(const id of this.poses.keys())if(!ids.has(id))this.poses.delete(id);}
 private updateTerrain(s:Snapshot):void{
  if(this.terrainSize!==s.size){if(this.terrain){this.scene.remove(this.terrain);this.terrain.geometry.dispose();this.terrain.material.dispose();this.texture?.dispose();}this.terrainSize=s.size;this.texture=new DataTexture(new Uint8Array(s.size*s.size*4),s.size,s.size,RGBAFormat);this.texture.colorSpace=SRGBColorSpace;this.texture.magFilter=NearestFilter;this.texture.minFilter=NearestFilter;this.terrain=new Mesh(new PlaneGeometry(s.size,s.size),new MeshStandardMaterial({map:this.texture,roughness:1}));this.terrain.rotation.x=-Math.PI/2;this.terrain.position.set(s.size/2,-.025,s.size/2);this.terrain.receiveShadow=true;this.scene.add(this.terrain);}
  terrainPixels(s,this.texture!.image.data as Uint8Array);this.texture!.needsUpdate=true;
 }
 center(p:Position):void{this.camera=iso(p);if(this.ready)this.configureCamera();}
 rotate(angle:number):void{this.yaw+=angle;this.configureCamera();}
 resetCamera():void{this.yaw=Math.PI/4;this.zoom=this.app.screen.width<600?.92:1.1;this.configureCamera();}
 private panScreen(x:number,y:number):void{if(Math.abs(this.yaw-Math.PI/4)<1e-10){this.camera.x-=x/this.zoom;this.camera.y-=y/this.zoom;return;}const a=uniso({x:x/this.zoom,y:y/this.zoom}),angle=this.yaw-Math.PI/4,b=iso({x:a.x*Math.cos(angle)+a.y*Math.sin(angle),y:-a.x*Math.sin(angle)+a.y*Math.cos(angle)});this.camera.x-=b.x;this.camera.y-=b.y;}
 private screenPoint(e:PointerEvent|WheelEvent):Position{const r=this.app.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 screenToWorld(p:Position):Position{this.configureCamera();return this.view.ground(p);}
 worldToScreen(p:Position):Position{this.configureCamera();return this.view.project(p);}
 private hit(p:Position):Entity|undefined{if(!this.snapshot||!this.ready)return;this.configureCamera();this.ray.setFromCamera(new Vector2(p.x/this.app.screen.width*2-1,1-p.y/this.app.screen.height*2),this.view.camera);const id=this.batches.pick(this.ray);return this.snapshot.entities.find(e=>e.id===id&&!e.ghost);}
 private down=(e:PointerEvent)=>{if(!this.interactive)return;const p=this.screenPoint(e);this.pointers.set(e.pointerId,p);this.app.canvas.setPointerCapture(e.pointerId);
  if(this.pointers.size===2){this.clearHold();const a=[...this.pointers.values()];this.initialPinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);this.initialZoom=this.zoom;this.initialAngle=Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x);this.initialYaw=this.yaw;this.drag=undefined;return;}
  this.drag={point:p,last:p,id:e.pointerId,button:e.button,touch:e.pointerType!=='mouse',hit:this.hit(p),shift:e.shiftKey,moved:false,pan:e.button===1||e.pointerType!=='mouse',rotate:e.button===0&&e.ctrlKey&&e.pointerType==='mouse'};
  this.clearHold();if(this.drag.touch){const drag=this.drag;this.holdTimer=setTimeout(()=>{if(this.drag===drag&&!drag.moved&&this.pointers.size===1){drag.pan=false;drag.held=true;}},450);}
 };
 private move=(e:PointerEvent)=>{const p=this.screenPoint(e);this.pointer=p;if(this.pointers.has(e.pointerId))this.pointers.set(e.pointerId,p);
  if(this.pointers.size===2){const a=[...this.pointers.values()];this.zoom=Math.max(.4,Math.min(2,this.initialZoom*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/Math.max(1,this.initialPinch)));const angle=Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x);this.yaw=this.initialYaw+Math.atan2(Math.sin(angle-this.initialAngle),Math.cos(angle-this.initialAngle));return;}
  const d=this.drag;if(!d||d.id!==e.pointerId)return;const delta=Math.hypot(p.x-d.point.x,p.y-d.point.y);if(delta>8){d.moved=true;this.clearHold();}if(d.moved&&d.rotate)this.yaw+=(p.x-d.last.x)*.008;if(d.moved&&d.pan){this.panScreen(p.x-d.last.x,p.y-d.last.y);}d.last=p;
 };
 private up=(e:PointerEvent)=>{this.clearHold();const p=this.screenPoint(e),d=this.drag;this.pointers.delete(e.pointerId);if(this.pointers.size>0){this.drag=undefined;return;}this.drag=undefined;if(!d)return;
  if(d.moved){if(!d.pan&&!d.rotate&&d.button===0&&this.snapshot){const ids=this.snapshot.entities.filter(v=>v.owner===this.snapshot!.playerId&&v.kind==='unit').filter(v=>{const q=this.worldToScreen(v);return q.x>=Math.min(d.point.x,p.x)&&q.x<=Math.max(d.point.x,p.x)&&q.y>=Math.min(d.point.y,p.y)&&q.y<=Math.max(d.point.y,p.y);}).map(v=>v.id);this.hooks.select(ids,d.shift);}return;}
  if(d.held||d.rotate||d.pan&&!d.touch)return;
  const world=this.screenToWorld(p),target=this.hit(p);
  if(d.button===2||this.mode||this.placement){this.hooks.action(world,target);return;}
  const selected=this.snapshot?.entities.filter(v=>this.selection.includes(v.id)&&v.owner===this.snapshot!.playerId&&v.kind==='unit')??[];
  if(!d.shift&&target?.kind==='building'&&target.owner===this.snapshot?.playerId&&target.hp>0&&target.progress<1&&selected.some(v=>v.type==='villager')){this.hooks.action(world,target);return;}
  if(d.touch&&selected.length&&(!target||target.owner!==this.snapshot?.playerId||target.type==='farm')){const workers=selected.some(v=>v.type==='villager'),army=selected.some(v=>v.type!=='villager');const taskTarget=target&&(target.kind==='resource'||target.type==='farm')&&!workers||target&&target.owner>=0&&target.owner!==this.snapshot?.playerId&&!army?undefined:target;this.hooks.action(world,taskTarget);return;}
  if(target)this.hooks.select([target.id],d.shift||d.touch&&this.selection.includes(target.id));else this.hooks.select([],false);
 };
 private cancelPointer=(e:PointerEvent)=>{this.clearHold();this.pointers.delete(e.pointerId);this.drag=undefined;};
 private context=(e:Event)=>e.preventDefault();
 private wheel=(e:WheelEvent)=>{if(!this.interactive)return;e.preventDefault();const p=this.screenPoint(e),before=this.screenToWorld(p);this.zoom=Math.max(.4,Math.min(2,this.zoom*Math.exp(-e.deltaY*.001)));const after=this.screenToWorld(p),a=iso(before),b=iso(after);this.camera.x+=a.x-b.x;this.camera.y+=a.y-b.y;};
 private keydown=(e:KeyboardEvent)=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.ctrlKey||e.metaKey)return;if(!e.repeat&&e.code==='KeyQ')this.rotate(-Math.PI/8);if(!e.repeat&&e.code==='KeyE')this.rotate(Math.PI/8);this.keys.add(e.code);if(e.code.startsWith('Arrow'))e.preventDefault();};
 private keyup=(e:KeyboardEvent)=>this.keys.delete(e.code);
 private blur=()=>{this.clearHold();this.keys.clear();this.drag=undefined;this.pointers.clear();};

 private loop=()=>{if(this.destroyed)return;this.draw();this.raf=requestAnimationFrame(this.loop);};
 private indicator(p:Position,height:number,width:number,value:number,enemy=false,ring=false):void{
  const add=(geometry:PlaneGeometry|RingGeometry,material:MeshBasicMaterial)=>{let mesh=this.indicatorPool[this.indicatorCount];if(!mesh){mesh=new Mesh(geometry,material);mesh.renderOrder=10;this.indicatorPool.push(mesh);this.indicators.add(mesh);}mesh.geometry=geometry;mesh.material=material;mesh.visible=true;this.indicatorCount++;return mesh;};
  if(ring){const m=add(this.ring,this.barMaterials[enemy?2:1]);m.position.set(p.x,.035,p.y);m.rotation.set(-Math.PI/2,0,0);m.scale.set(width,width,width);return;}
  const back=add(this.bar,this.barMaterials[0]);back.position.set(p.x,height,p.y);back.quaternion.copy(this.view.camera.quaternion);back.scale.set(width,.075,1);
  const front=add(this.bar,this.barMaterials[enemy?2:1]),fraction=Math.max(0,Math.min(1,value));front.position.copy(back.position);front.quaternion.copy(back.quaternion);front.translateX((fraction-1)*width/2);front.scale.set(width*fraction,.058,1);front.renderOrder=11;
 }
 private draw():void{
  if(!this.snapshot||!this.renderer)return;const s=this.snapshot,now=performance.now(),dt=Math.min(.05,(now-this.lastTime)/1000);this.frameTimes.push(now-this.lastTime);if(this.frameTimes.length>120)this.frameTimes.shift();this.lastTime=now;
  if(this.interactive){const speed=600*dt;this.panScreen((this.keys.has('ArrowLeft')?speed:0)-(this.keys.has('ArrowRight')?speed:0),(this.keys.has('ArrowUp')?speed:0)-(this.keys.has('ArrowDown')?speed:0));}
  const focus=uniso(this.camera);focus.x=Math.max(0,Math.min(s.size,focus.x));focus.y=Math.max(0,Math.min(s.size,focus.y));this.camera=iso(focus);this.configureCamera();
  if(this.sun){this.sun.position.set(focus.x-18,32,focus.y+12);this.sun.target.position.set(focus.x,0,focus.y);}
  this.batches.begin();this.indicatorCount=0;let shots=0;const selected=new Set(this.selection);
  for(const e of s.entities){if(e.garrisoned!==undefined||e.kind==='resource'&&e.amount<=0)continue;const n=e.kind==='building'?BUILDINGS[e.type as BuildingType].size:0,point={x:e.x+n*.5,y:e.y+n*.5};const projected=this.view.project(point);if(projected.x< -180||projected.x>this.app.screen.width+180||projected.y< -100||projected.y>this.app.screen.height+230)continue;
   let pose=this.poses.get(e.id);if(!pose){pose={...point,heading:0,seenAt:now};this.poses.set(e.id,pose);}if(now-pose.seenAt>500){pose.x=point.x;pose.y=point.y;}pose.seenAt=now;const distance=Math.hypot(point.x-pose.x,point.y-pose.y),moving=(e.kind==='unit'||e.type==='deer')&&distance>.015;const factor=1-Math.exp(-dt*12);if(moving)pose.heading=Math.atan2(point.x-pose.x,point.y-pose.y);pose.x+=(point.x-pose.x)*factor;pose.y+=(point.y-pose.y)*factor;
   this.root.position.set(pose.x,0,pose.y);this.root.rotation.set(0,e.type==='deer'?pose.heading-Math.PI/2:e.kind==='unit'?pose.heading:0,0);const scale=e.hp<=0?.12:e.kind==='building'?Math.max(.08,e.progress):1;this.root.scale.set(1,scale,1);this.root.updateMatrix();const work=e.kind==='unit'&&['gather','build','repair'].includes(e.order.kind),attacking=!!e.attackFx&&s.tick-e.attackFx.tick<8;
   const gateOpen=e.type==='gate'&&s.entities.some(u=>u.kind==='unit'&&u.owner===e.owner&&Math.hypot(u.x-point.x,u.y-point.y)<2);
   for(const part of this.models.get(e.type,e.owner))this.batches.add(part,this.root.matrix,e.ghost?0x697466:e.hp<=0?0x615949:0xffffff,now*.012+e.id,moving?1:0,work,attacking,gateOpen,e.ghost?0:e.id);
   const height=e.kind==='building'?(e.type==='fortress'?4.4:3.6):['cavalry','heavyCavalry','scout'].includes(e.type)?2.2:1.7;
   if(selected.has(e.id)){this.indicator(pose,.04,n?n*.56:.44,1,e.owner!==s.playerId,true);this.indicator(pose,height,n?1.65:.85,e.hp/e.maxHp,e.owner!==s.playerId);}
   else if(!e.ghost&&e.hp>0&&e.hp<e.maxHp*.99)this.indicator(pose,height,n?1.65:.85,e.hp/e.maxHp,e.owner!==s.playerId);
   if(e.kind==='building'&&e.progress<1&&e.hp>0)this.indicator(pose,height,1.3,e.progress);
   if(e.occupation)this.indicator(pose,1.3,2,e.occupation.progress/30,true);
   if(e.attackFx&&s.tick-e.attackFx.tick<20&&['archer','crossbowman','trebuchet','tower','fortress','capital'].includes(e.type)){let shot=this.projectiles[shots];if(!shot){shot=new Mesh(this.projectileGeometry,this.projectileMaterial);this.projectiles.push(shot);this.scene.add(shot);}const age=(s.tick-e.attackFx.tick)/20;shot.visible=true;shot.position.set(pose.x+(e.attackFx.x-pose.x)*age,height*(1-age)+Math.sin(age*Math.PI)*2,pose.y+(e.attackFx.y-pose.y)*age);shot.scale.setScalar(e.type==='trebuchet'?3:1);shots++;}
  }
  this.batches.end();for(let i=this.indicatorCount;i<this.indicatorPool.length;i++)this.indicatorPool[i].visible=false;for(let i=shots;i<this.projectiles.length;i++)this.projectiles[i].visible=false;
  this.preview.visible=false;if(this.placement&&this.pointer){const p=this.screenToWorld(this.pointer),x=Math.floor(p.x),y=Math.floor(p.y),n=BUILDINGS[this.placement].size;const valid=x>0&&y>0&&x+n<s.size&&y+n<s.size&&s.fog[y*s.size+x]===2&&!s.entities.some(e=>e.kind==='building'&&x<e.x+BUILDINGS[e.type as BuildingType].size&&x+n>e.x&&y<e.y+BUILDINGS[e.type as BuildingType].size&&y+n>e.y||e.kind==='resource'&&e.amount>0&&e.x>=x&&e.x<x+n&&e.y>=y&&e.y<y+n);this.preview.visible=true;this.preview.position.set(x+n/2,.07,y+n/2);this.preview.scale.set(n,1,n);this.preview.material.color.setHex(valid?0xb8d491:0xe48872);}
  const drag=this.drag;if(this.selectionBox){const box=this.selectionBox,show=!!drag?.moved&&!drag.pan&&drag.button===0;box.style.display=show?'block':'none';if(show&&drag){box.style.left=Math.min(drag.point.x,drag.last.x)+'px';box.style.top=Math.min(drag.point.y,drag.last.y)+'px';box.style.width=Math.abs(drag.point.x-drag.last.x)+'px';box.style.height=Math.abs(drag.point.y-drag.last.y)+'px';}}
  this.renderer.render(this.scene,this.view.camera);
 }
 metrics():{fps:number;renderer:string}{return{fps:1000/(this.frameTimes.reduce((a,b)=>a+b,0)/Math.max(1,this.frameTimes.length)),renderer:'3D WebGL'};}
 destroy():void{this.clearHold();this.destroyed=true;cancelAnimationFrame(this.raf);this.resize?.disconnect();window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);this.batches.dispose();this.models.dispose();this.terrain?.geometry.dispose();this.terrain?.material.dispose();this.texture?.dispose();this.ring.dispose();this.bar.dispose();for(const m of this.barMaterials)m.dispose();this.preview.geometry.dispose();this.preview.material.dispose();this.projectileGeometry.dispose();this.projectileMaterial.dispose();this.sun?.shadow.dispose();this.renderer?.dispose();this.renderer?.forceContextLoss();this.app.canvas?.remove();this.selectionBox?.remove();this.poses.clear();this.ready=false;}
}
