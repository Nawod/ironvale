import {BufferGeometry,Float32BufferAttribute,MeshStandardMaterial,InstancedMesh,Object3D,Scene,Color,DodecahedronGeometry} from 'three';
import type {Position,Snapshot} from '../sim/types';

/** Bounded cosmetic grass/pebbles; no collision, resources, or unseen information. */
export class GroundCover {
 private grass:InstancedMesh;private pebbles:InstancedMesh;
 private transform=new Object3D();private color=new Color();private stamp='';
 private fog?:number[];private settlement?:Uint8Array;
 constructor(private scene:Scene,private limit=600){
  const vertices:number[]=[];
  for(let i=0;i<3;i++){const a=i*Math.PI/3,c=Math.cos(a)*.032,z=Math.sin(a)*.032;vertices.push(-c,0,-z,c,0,z,c*.6,.10+i*.025,z*.6);}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  this.grass=new InstancedMesh(geometry,new MeshStandardMaterial({color:0x899753,roughness:1,side:2}),limit);
  this.pebbles=new InstancedMesh(new DodecahedronGeometry(1,0),new MeshStandardMaterial({color:0xa09c83,roughness:1}),Math.ceil(limit/5));
  for(const mesh of [this.grass,this.pebbles]){mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.count=0;scene.add(mesh);}
 }
 update(s:Snapshot,focus:Position,settlement?:Uint8Array):void{
  const stamp=`${Math.floor(focus.x/2)}:${Math.floor(focus.y/2)}:${Math.floor(s.tick/10)}:${s.size}`;if(stamp===this.stamp&&this.fog===s.fog&&this.settlement===settlement)return;this.stamp=stamp;this.fog=s.fog;this.settlement=settlement;
  let grass=0,stone=0;
  for(let dy=-21;dy<=21;dy++)for(let dx=-21;dx<=21;dx++){
   const x=Math.floor(focus.x)+dx,y=Math.floor(focus.y)+dy;if(x<1||y<1||x>=s.size-1||y>=s.size-1||s.fog[y*s.size+x]!==2)continue;
   const h=(Math.imul(x+31,73856093)^Math.imul(y+53,19349663))>>>0;if(h%3!==0)continue;
   const px=x+.15+(h%701)/1000,py=y+.15+((h>>>10)%701)/1000;
   if((settlement?.[Math.floor(py*4)*s.size*4+Math.floor(px*4)]??0)>50)continue;
   const pebble=h%17===0;if(pebble?stone>=this.pebbles.instanceMatrix.count:grass>=this.limit)continue;
   const scale=.6+(h%100)/100;
   this.transform.position.set(px,pebble?.02:0,py);this.transform.rotation.set(0,(h%6283)/1000,0);this.transform.scale.set(pebble?.065*scale:scale,pebble?.04*scale:scale,pebble?.07*scale:scale);this.transform.updateMatrix();
   const mesh=pebble?this.pebbles:this.grass,index=pebble?stone++:grass++;mesh.setMatrixAt(index,this.transform.matrix);this.color.setHSL(pebble?.13:.2+(h%30)/1000,pebble?.1:.24,.29+(h%14)/100);mesh.setColorAt(index,this.color);
  }
  this.grass.count=grass;this.pebbles.count=stone;for(const mesh of [this.grass,this.pebbles]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 }
 dispose():void{for(const mesh of [this.grass,this.pebbles]){this.scene.remove(mesh);mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();mesh.dispose();}}
}
