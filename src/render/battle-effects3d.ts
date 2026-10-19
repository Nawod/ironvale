import {Vector3,Scene,InstancedMesh,MeshStandardMaterial,CylinderGeometry,ConeGeometry,IcosahedronGeometry,Object3D,type BufferGeometry} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Position,Entity} from '../sim/types';

export function turnToward(current:number,target:number,dt:number):number{
 const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));return current+delta*(1-Math.exp(-dt*14));
}
export function projectilePose(from:Position&{height:number},target:Position,progress:number,siege:boolean,targetHeight=0):{position:Vector3;direction:Vector3}{
 const t=Math.max(0,Math.min(1,progress)),arc=siege?2.8:.55;
 return {position:new Vector3(from.x+(target.x-from.x)*t,from.height+(targetHeight+.15-from.height)*t+Math.sin(t*Math.PI)*arc,from.y+(target.y-from.y)*t),direction:new Vector3(target.x-from.x,targetHeight+.15-from.height+Math.cos(t*Math.PI)*Math.PI*arc,target.y-from.y).normalize()};
}

export type DirectProjectile='bullet'|'cannonball'|'bolt';
/** Firearms follow a direct line, never the bow or trebuchet trajectory. The
 * legendary craft has its own very shallow cosmetic bolt arc. */
export function directProjectilePose(from:Position&{height:number},target:Position,progress:number,kind:DirectProjectile,targetHeight=0):{position:Vector3;direction:Vector3}{
 const t=Math.max(0,Math.min(1,progress)),arc=kind==='bolt'?.12:0,dx=target.x-from.x,dz=target.y-from.y,dy=targetHeight+.15-from.height;
 const direction=new Vector3(dx,dy+Math.cos(t*Math.PI)*Math.PI*arc,dz);if(direction.lengthSq()<1e-10)direction.set(0,0,1);else direction.normalize();
 return {position:new Vector3(from.x+dx*t,from.height+dy*t+Math.sin(t*Math.PI)*arc,from.y+dz*t),direction};
}

interface EffectPool {mesh:InstancedMesh;count:number}

/** Snapshot effects are cosmetic: no new targets, combat timers or damage. */
export class BattleEffects {
 private arrows:EffectPool;private stones:EffectPool;private bullets:EffectPool;private tracers:EffectPool;private balls:EffectPool;private bolts:EffectPool;private flashes:EffectPool;private smoke:EffectPool;
 private pools:EffectPool[]=[];private transform=new Object3D();private up=new Vector3(0,1,0);private disposed=false;
 private origins=new Map<number,{tick:number;x:number;y:number;height:number}>();private tick=0;
 constructor(private scene:Scene,private limit=256){
  this.limit=Math.max(1,Math.floor(Number.isFinite(limit)?limit:256));
  const originalShaft=new CylinderGeometry(.013,.013,.57,4),originalTip=new ConeGeometry(.035,.12,4),originalTail=new ConeGeometry(.045,.13,4);
  const shaft=originalShaft.toNonIndexed(),tip=originalTip.toNonIndexed(),tail=originalTail.toNonIndexed();originalShaft.dispose();originalTip.dispose();originalTail.dispose();tip.translate(0,.33,0);tail.rotateX(Math.PI);tail.translate(0,-.22,0);
  const geometry=mergeGeometries([shaft,tip,tail]);shaft.dispose();tip.dispose();tail.dispose();
  this.arrows=this.pool('Battle arrows',geometry!,new MeshStandardMaterial({color:0xb6a17a,roughness:.7}));
  this.stones=this.pool('Battle siege stones',new IcosahedronGeometry(.2,1),new MeshStandardMaterial({color:0x918979,roughness:1}));
  this.bullets=this.pool('Battle lead bullets',new IcosahedronGeometry(.035,0),new MeshStandardMaterial({color:0x666e70,roughness:.45,metalness:.55}));
  this.tracers=this.pool('Battle bullet tracers',new CylinderGeometry(.012,.012,.36,4),new MeshStandardMaterial({color:0xe0c38a,emissive:0xa4752b,emissiveIntensity:.65,roughness:.6}));
  this.balls=this.pool('Battle cannonballs',new IcosahedronGeometry(.115,1),new MeshStandardMaterial({color:0x292f30,roughness:.5,metalness:.6}));
  this.bolts=this.pool('Battle Dandu bolts',new ConeGeometry(.045,.62,5),new MeshStandardMaterial({color:0x79c9d4,emissive:0x397e90,emissiveIntensity:1,roughness:.45,metalness:.35}));
  this.flashes=this.pool('Battle muzzle flashes',new IcosahedronGeometry(1,0),new MeshStandardMaterial({color:0xffd174,emissive:0xff9c30,emissiveIntensity:2.6,roughness:1}));
  this.smoke=this.pool('Battle gun smoke',new IcosahedronGeometry(1,1),new MeshStandardMaterial({color:0xb7b4a6,roughness:1,transparent:true,opacity:.24,depthWrite:false}));
 }
 private pool(name:string,geometry:BufferGeometry,material:MeshStandardMaterial):EffectPool{const mesh=new InstancedMesh(geometry,material,this.limit);mesh.name=name;mesh.frustumCulled=false;mesh.count=0;mesh.visible=false;this.scene.add(mesh);const pool={mesh,count:0};this.pools.push(pool);return pool;}
 private put(pool:EffectPool,position:Vector3,direction?:Vector3,size=1):void{
  if(pool.count>=this.limit)return;this.transform.position.copy(position);if(direction)this.transform.quaternion.setFromUnitVectors(this.up,direction);else this.transform.quaternion.identity();this.transform.scale.setScalar(size);this.transform.updateMatrix();pool.mesh.setMatrixAt(pool.count++,this.transform.matrix);
 }
 begin(tick:number):void{
  if(this.disposed)return;if(tick<this.tick)this.origins.clear();this.tick=tick;for(const pool of this.pools)pool.count=0;
  for(const [id,origin]of this.origins)if(tick-origin.tick>=20)this.origins.delete(id);
 }
 add(e:Pick<Entity,'id'|'type'|'attackFx'>,point:Position,height:number,targetHeight=0):void{
  if(this.disposed||!e.attackFx||!['archer','crossbowman','trebuchet','tower','fortress','capital','musketeer','rifleman','cannon','danduMonara'].includes(e.type))return;
  const age=this.tick-e.attackFx.tick;if(age<0||age>=20)return;
  const gun=e.type==='musketeer'||e.type==='rifleman',cannon=e.type==='cannon',aircraft=e.type==='danduMonara',siege=e.type==='trebuchet';
  const pool=gun?this.bullets:cannon?this.balls:aircraft?this.bolts:siege?this.stones:this.arrows;if(pool.count>=this.limit)return;
  let origin=this.origins.get(e.id);if(!origin||origin.tick!==e.attackFx.tick){
   const reach=gun?.86:cannon?1.1:0,dx=e.attackFx.x-point.x,dz=e.attackFx.y-point.y,length=Math.hypot(dx,dz)||1;
   // Caller supplies the already-visible actor and its world-space release
   // height, including flight altitude. No target/entity/fog queries occur here.
   origin={x:point.x+dx/length*reach,y:point.y+dz/length*reach,height,tick:e.attackFx.tick};
   // At most one lifetime of accepted pool slots is remembered, even if a
   // caller changes entity identities each tick without completing a frame.
   if(this.origins.size>=this.limit*20*this.pools.length)this.origins.delete(this.origins.keys().next().value!);
   this.origins.set(e.id,origin);
  }
  if(gun||cannon||aircraft){
   const kind:DirectProjectile=gun?'bullet':cannon?'cannonball':'bolt',flight=gun?6:cannon?14:18;
   if(age<flight){const pose=directProjectilePose(origin,e.attackFx,age/flight,kind,targetHeight);this.put(pool,pose.position,pose.direction);if(gun)this.put(this.tracers,pose.position,pose.direction);}
   if((gun||cannon)&&age<2)this.put(this.flashes,new Vector3(origin.x,origin.height,origin.y),undefined,(cannon?.34:.14)*(1-age*.25));
   if((gun||cannon)&&age<(cannon?12:8))this.put(this.smoke,new Vector3(origin.x,origin.height+age*.025,origin.y),undefined,(cannon?.2:.08)+age*(cannon?.038:.019));
  }else {const pose=projectilePose(origin,e.attackFx,age/20,siege,targetHeight);this.put(pool,pose.position,pose.direction);}
 }
 end():void{if(this.disposed)return;for(const {mesh,count} of this.pools){mesh.count=count;mesh.visible=count>0;if(count)mesh.instanceMatrix.needsUpdate=true;}}
 dispose():void{if(this.disposed)return;this.disposed=true;for(const {mesh}of this.pools){this.scene.remove(mesh);mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();mesh.dispose();}this.origins.clear();}
}
