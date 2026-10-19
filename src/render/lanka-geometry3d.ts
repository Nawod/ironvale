import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS } from '../sim/definitions';
import type { ModelPart } from './models3d';

export const LANKA_FACTIONS=['anuradhapura','polonnaruwa','kandy','chola','elara','jaffna','portuguese','dutch','british','ravana'] as const;
export type LankaFaction=typeof LANKA_FACTIONS[number];
export type Vec=[number,number,number];
export type Paint='ivory'|'stone'|'tile'|'wood'|'dark'|'gold'|'skin'|'cloth'|'team'|'iron'|'barrel'|'red'|'blue'|'green';
type Shape='box'|'sphere'|'cone'|'cylinder'|'ring'|'wing';
export interface Detail {shape:Shape;paint:Paint;p:Vec;s:Vec;r:Vec}
interface Template {geometry:BufferGeometry;paint:Paint}
const colors:Record<Paint,string>={ivory:'#ecdfbf',stone:'#96785c',tile:'#b75a36',wood:'#624122',dark:'#20221d',gold:'#caa84f',skin:'#9e6d43',cloth:'#d8c5a0',team:'#ffffff',iron:'#626969',barrel:'#303b3c',red:'#a52d24',blue:'#263e68',green:'#426644'};

/** Original equipment/architecture geometry. Compiles ornamental details into one
 * shared batch per material; entity identity never enters the resource cache. */
export class LankaGeometry {
 private shapes:Record<Shape,BufferGeometry>;
 private geometries=new Set<BufferGeometry>();
 private materials=new Map<string,MeshStandardMaterial>();
 private templates=new Map<string,Template[]>();
 private variants=new Map<string,ModelPart[]>();
 private disposed=false;
 constructor(){
  const wing=new BufferGeometry();wing.setAttribute('position',new Float32BufferAttribute([0,0,-.4,1,0,-.05,.82,.08,.5,.35,.06,.7,0,.08,.4,0,-.07,-.4,1,-.07,-.05,.82,-.02,.5,.35,-.03,.7,0,-.02,.4],3));wing.setIndex([0,1,2,0,2,3,0,3,4,5,7,6,5,8,7,5,9,8,0,5,6,0,6,1,1,6,7,1,7,2,2,7,8,2,8,3,3,8,9,3,9,4]);wing.computeVertexNormals();
  this.shapes={box:new BoxGeometry(1,1,1),sphere:new SphereGeometry(.5,12,8),cone:new ConeGeometry(.5,1,12),cylinder:new CylinderGeometry(.5,.5,1,12),ring:new TorusGeometry(.5,.055,6,20),wing};
 }
 get(key:string,owner:number,build:()=>Detail[]):ModelPart[] {
  const city=Math.max(0,Math.floor(Number.isFinite(owner)?owner:0))%COLORS.length, cacheKey=`${key}:${city}`;
  const cached=this.variants.get(cacheKey);if(cached)return cached;if(this.disposed)return [];
  let template=this.templates.get(key);
  if(!template){
   const groups=new Map<Paint,BufferGeometry[]>(),transform=new Object3D();
   for(const part of build()){
    transform.position.fromArray(part.p);transform.scale.fromArray(part.s);transform.rotation.set(...part.r);transform.updateMatrix();
    const g=this.shapes[part.shape].clone().applyMatrix4(transform.matrix);g.deleteAttribute('uv');
    const expanded=g.index?g.toNonIndexed():g;if(expanded!==g)g.dispose();
    const group=groups.get(part.paint)??[];group.push(expanded);groups.set(part.paint,group);
   }
   template=[];for(const [paint,copies] of groups){const geometry=mergeGeometries(copies,false)!;copies.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.lankaOriginal=true;this.geometries.add(geometry);template.push({geometry,paint});}this.templates.set(key,template);
  }
  const parts:ModelPart[]=template.map(part=>({geometry:part.geometry,material:this.material(part.paint,city),position:[0,0,0],scale:[1,1,1],rotation:[0,0,0]}));this.variants.set(cacheKey,parts);return parts;
 }
 private material(paint:Paint,owner:number){
  const key=paint==='team'?`${paint}:${owner}`:paint;let m=this.materials.get(key);if(m)return m;
  m=new MeshStandardMaterial({name:`Lanka:${key}`,color:new Color(paint==='team'?COLORS[owner]:colors[paint]),roughness:['gold','iron','barrel'].includes(paint)?.46:.85,metalness:['gold','iron','barrel'].includes(paint)?.65:0,side:DoubleSide});m.userData.lankaRole=paint;this.materials.set(key,m);return m;
 }
 metrics(){let triangles=0,geometryBytes=0;for(const g of this.geometries){triangles+=(g.index?.count??g.getAttribute('position').count)/3;for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=g.index?.array.byteLength??0;}return {geometries:this.geometries.size,materials:this.materials.size,cachedFrames:this.variants.size,triangles,geometryBytes};}
 dispose(){if(this.disposed)return;this.disposed=true;for(const s of Object.values(this.shapes))s.dispose();for(const g of this.geometries)g.dispose();for(const m of this.materials.values())m.dispose();this.geometries.clear();this.materials.clear();this.variants.clear();this.templates.clear();}
}

export function detailBuilder(){
 const parts:Detail[]=[];
 const add=(shape:Shape,paint:Paint,p:Vec,s:Vec,r:Vec=[0,0,0])=>parts.push({shape,paint,p,s,r});
 const box=(paint:Paint,x:number,y:number,z:number,w:number,h:number,d:number,r:Vec=[0,0,0])=>add('box',paint,[x,y,z],[w,h,d],r);
 const beam=(paint:Paint,a:Vec,b:Vec,w=.055)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];add('cylinder',paint,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[w,Math.hypot(dx,dy,dz),w],[Math.atan2(dz,dy),0,-Math.atan2(dx,Math.hypot(dy,dz))]);};
 return {parts,add,box,beam};
}
