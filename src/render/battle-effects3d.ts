import {Vector3,Scene,InstancedMesh,MeshStandardMaterial,CylinderGeometry,ConeGeometry,IcosahedronGeometry,Object3D} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Position,Entity} from '../sim/types';

export function turnToward(current:number,target:number,dt:number):number{
 const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));return current+delta*(1-Math.exp(-dt*14));
}
export function projectilePose(from:Position&{height:number},target:Position,progress:number,siege:boolean):{position:Vector3;direction:Vector3}{
 const t=Math.max(0,Math.min(1,progress)),arc=siege?2.8:.55;
 return {position:new Vector3(from.x+(target.x-from.x)*t,from.height+(.15-from.height)*t+Math.sin(t*Math.PI)*arc,from.y+(target.y-from.y)*t),direction:new Vector3(target.x-from.x,.15-from.height+Math.cos(t*Math.PI)*Math.PI*arc,target.y-from.y).normalize()};
}

/** Snapshot effects are cosmetic: no new targets, combat timers or damage. */
export class BattleEffects {
 private arrows:InstancedMesh;private stones:InstancedMesh;private transform=new Object3D();private up=new Vector3(0,1,0);
 private origins=new Map<number,{tick:number;x:number;y:number;height:number}>();private tick=0;private arrowCount=0;private stoneCount=0;
 constructor(private scene:Scene,private limit=256){
  const shaft=new CylinderGeometry(.013,.013,.57,4).toNonIndexed(),tip=new ConeGeometry(.035,.12,4).toNonIndexed(),tail=new ConeGeometry(.045,.13,4).toNonIndexed();tip.translate(0,.33,0);tail.rotateX(Math.PI);tail.translate(0,-.22,0);
  const geometry=mergeGeometries([shaft,tip,tail]);shaft.dispose();tip.dispose();tail.dispose();
  this.arrows=new InstancedMesh(geometry,new MeshStandardMaterial({color:0xb6a17a,roughness:.7}),limit);this.arrows.name='Battle arrows';
  this.stones=new InstancedMesh(new IcosahedronGeometry(.2,1),new MeshStandardMaterial({color:0x918979,roughness:1}),limit);this.stones.name='Battle siege stones';
  for(const mesh of [this.arrows,this.stones]){mesh.frustumCulled=false;mesh.count=0;scene.add(mesh);}
 }
 begin(tick:number):void{
  if(tick<this.tick)this.origins.clear();this.tick=tick;this.arrowCount=this.stoneCount=0;
  for(const [id,origin]of this.origins)if(tick-origin.tick>=20)this.origins.delete(id);
 }
 add(e:Pick<Entity,'id'|'type'|'attackFx'>,point:Position,height:number):void{
  if(!e.attackFx||!['archer','crossbowman','trebuchet','tower','fortress','capital'].includes(e.type))return;
  const age=this.tick-e.attackFx.tick;if(age<0||age>=20)return;const siege=e.type==='trebuchet';
  if(siege?this.stoneCount>=this.limit:this.arrowCount>=this.limit)return;
  let origin=this.origins.get(e.id);if(!origin||origin.tick!==e.attackFx.tick){origin={...point,height,tick:e.attackFx.tick};this.origins.set(e.id,origin);}
  const pose=projectilePose(origin,e.attackFx,age/20,siege);this.transform.position.copy(pose.position);this.transform.quaternion.setFromUnitVectors(this.up,pose.direction);this.transform.scale.setScalar(1);this.transform.updateMatrix();
  if(siege)this.stones.setMatrixAt(this.stoneCount++,this.transform.matrix);else this.arrows.setMatrixAt(this.arrowCount++,this.transform.matrix);
 }
 end():void{for(const [mesh,count]of [[this.arrows,this.arrowCount],[this.stones,this.stoneCount]] as const){mesh.count=count;mesh.visible=count>0;if(count)mesh.instanceMatrix.needsUpdate=true;}}
 dispose():void{for(const mesh of [this.arrows,this.stones]){this.scene.remove(mesh);mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();mesh.dispose();}this.origins.clear();}
}
