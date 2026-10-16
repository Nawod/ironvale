import {describe,it,expect} from 'vitest';
import {Box3,Object3D,Mesh,Raycaster,Vector3} from 'three';
import {MedievalBuildings} from '../src/render/medieval-buildings3d';
import {BUILDINGS,COLORS} from '../src/sim/definitions';
import type {BuildingType,Entity} from '../src/sim/types';
import type {ModelPart} from '../src/render/models3d';
import {wallLayouts,type WallLayout} from '../src/render/wall-orientation';

const entity=(type:BuildingType,owner=0):Entity=>({id:1,kind:'building',type,owner,x:0,y:0,hp:100,maxHp:100,order:{kind:'idle'},path:[],cooldown:0,progress:1,queue:[],amount:0,stance:'hold',garrison:[]});
function bounds(parts:ModelPart[]):Box3{
 const result=new Box3(),transform=new Object3D();
 for(const part of parts){part.geometry.computeBoundingBox();transform.position.fromArray(part.position);transform.scale.fromArray(part.scale);transform.rotation.set(...part.rotation);transform.updateMatrix();result.union(part.geometry.boundingBox!.clone().applyMatrix4(transform.matrix));}
 return result;
}
function solidHeight(parts:ModelPart[],x:number,z:number):number{
 const ray=new Raycaster(new Vector3(x,5,z),new Vector3(0,-1,0),0,6);let height=0;
 for(const part of parts.filter(p=>!p.motion)){
  const mesh=new Mesh(part.geometry,part.material);mesh.position.fromArray(part.position);mesh.scale.fromArray(part.scale);mesh.rotation.set(...part.rotation);mesh.updateMatrixWorld();
  for(const hit of ray.intersectObject(mesh))height=Math.max(height,hit.point.y);
 }
 return height;
}
const layout=(mask:number,gatePorts=0):WallLayout=>({yaw:0,mask,gatePorts});

describe('original medieval architecture',()=>{
 it.each(['palisade','wall'] as const)('joins the actual %s geometry at every required corner, T and cross edge',type=>{
  const library=new MedievalBuildings(),ports=[[0,-.49],[.49,0],[0,.49],[-.49,0]];
  for(const mask of [3,6,9,12,7,11,13,14,15]){
   const parts=library.get(entity(type),2,layout(mask))!;
   for(let side=0;side<4;side++){
    const [x,z]=ports[side],height=solidHeight(parts,x,z);
    if(mask&(1<<side))expect(height,`${type} mask ${mask} edge ${side} must reach its neighbor`).toBeGreaterThan(1.3);
    else expect(height,`${type} mask ${mask} must not leave a straight wall through an unconnected edge ${side}`).toBeLessThan(.3);
   }
   expect(solidHeight(parts,0,0),'the elbow itself has no hole').toBeGreaterThan(1.3);
  }
  library.dispose();
 });
 it('connects a gate to both offset tile centers on each edge while preserving its central passage',()=>{
  const library=new MedievalBuildings(),ports=[[-.5,-.99],[.5,-.99],[.99,-.5],[.99,.5],[-.5,.99],[.5,.99],[-.99,-.5],[-.99,.5]];
  for(let port=0;port<8;port++){
   const parts=library.get(entity('gate'),2,layout(0,1<<port))!,[x,z]=ports[port];
   expect(solidHeight(parts,x,z),`gate adapter ${port} reaches the actual adjacent tile center`).toBeGreaterThan(1.3);
   for(const clearanceX of [-.3,0,.3]){
    const ray=new Raycaster(new Vector3(clearanceX,1,2),new Vector3(0,0,-1),0,4);
    for(const part of parts.filter(p=>p.motion!=='gate')){
     const mesh=new Mesh(part.geometry,part.material);mesh.position.fromArray(part.position);mesh.scale.fromArray(part.scale);mesh.rotation.set(...part.rotation);mesh.updateMatrixWorld();
     expect(ray.intersectObject(mesh).length,`gate port ${port} blocks the passage at x=${clearanceX}`).toBe(0);
    }
   }
   expect(parts.some(p=>p.motion==='gate')).toBe(true);
  }
  library.dispose();
 });
 it.each(['x','y'] as const)('closes the real world seam between a wooden wall and an offset gate port along %s',axis=>{
  const library=new MedievalBuildings(),wall={...entity('palisade'),id:1,x:axis==='x'?-1:0,y:axis==='y'?-1:0},gate={...entity('gate'),id:2},layouts=wallLayouts([wall,gate]);
  const meshes:Mesh[]=[];
  for(const building of [wall,gate]){
   const orientation=layouts.get(building.id)!,root=new Object3D(),n=BUILDINGS[building.type as BuildingType].size;
   root.position.set(building.x+n/2,0,building.y+n/2);root.rotation.y=orientation.yaw;
   for(const part of library.get(building,2,orientation)!){
    const mesh=new Mesh(part.geometry,part.material);mesh.position.fromArray(part.position);mesh.scale.fromArray(part.scale);mesh.rotation.set(...part.rotation);root.add(mesh);meshes.push(mesh);
   }
   root.updateMatrixWorld(true);
  }
  for(let offset=-.12;offset<=.12;offset+=.02){
   const ray=new Raycaster(new Vector3(axis==='x'?offset:.5,5,axis==='y'?offset:.5),new Vector3(0,-1,0),0,6);
   expect(ray.intersectObjects(meshes).some(hit=>hit.point.y>1.3),`open gap at world seam ${offset}`).toBe(true);
  }
  library.dispose();
 });
 it('bounds all connection variants, shares their geometry between ages and cities and releases them once',()=>{
  const library=new MedievalBuildings(),geometry=new Set(Object.values(library.shapes)),materials=new Set<ModelPart['material']>();
  for(const type of ['palisade','wall','gate'] as const)for(const tier of type==='wall'?[undefined,3 as const]:[undefined])for(let variant=0;variant<(type==='gate'?256:16);variant++){
   const connection=type==='gate'?layout(0,variant):layout(variant),building={...entity(type),wallTier:tier},first=library.get(building,1,connection)!;
   for(let owner=0;owner<8;owner++){
    const parts=library.get({...building,owner,id:10000+variant,x:700,y:800},3,connection)!;
    expect(parts.map(part=>part.geometry)).toEqual(first.map(part=>part.geometry));
    expect(library.get({...building,owner},2,{yaw:99,mask:connection.mask+256,gatePorts:connection.gatePorts+256})).toBe(parts);
    for(const part of parts){geometry.add(part.geometry);materials.add(part.material);}
   }
  }
  expect((library as any).templates.size).toBe(301);
  expect(geometry.size).toBeLessThan(3100);expect(materials.size).toBeLessThan(30);
  const textures=new Set([...materials].flatMap(material=>[material.map,material.bumpMap].filter(texture=>texture!==null)));
  const resources=[...geometry,...materials,...textures],counts=new Map<object,number>();
  for(const resource of resources)resource.addEventListener('dispose',()=>counts.set(resource,(counts.get(resource)??0)+1));
  library.dispose();library.dispose();
  expect(resources.every(resource=>counts.get(resource)===1)).toBe(true);
 });
 it('keeps all sixteen building classes finite and centered on their collision footprints in every age',()=>{
  const library=new MedievalBuildings();
  for(const type of Object.keys(BUILDINGS) as BuildingType[])for(const age of [1,2,3]){
   const parts=library.get(entity(type),age)!;
   expect(parts.length,`${type} age ${age}`).toBeGreaterThan(2);
   expect(parts.length,`${type} batching`).toBeLessThan(22);
   const b=bounds(parts),size=BUILDINGS[type].size;
   expect([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite)).toBe(true);
   expect(b.min.y).toBeGreaterThanOrEqual(-.03);
   expect(b.max.y).toBeLessThan(6.2);
   expect(Math.max(Math.abs(b.min.x),Math.abs(b.max.x))).toBeLessThanOrEqual(size*.62);
   expect(Math.max(Math.abs(b.min.z),Math.abs(b.max.z))).toBeLessThanOrEqual(size*.62);
   expect(parts.some(p=>p.material.name==='medieval:team:0'),`${type} age ${age} city marker`).toBe(true);
  }
  expect(bounds(library.get(entity('house'),2)!).max.y).toBeGreaterThan(2.4);
  expect(bounds(library.get(entity('fortress'),3)!).max.y).toBeGreaterThan(4.5);
  library.dispose();
 });
 it('moves the actual portcullis and leaves a clear passage when its moving parts lift',()=>{
  const library=new MedievalBuildings(),parts=library.get(entity('gate'),2)!;
  const panel=parts.filter(p=>p.motion==='gate'&&p.material.name==='medieval:wood');
  expect(panel).toHaveLength(1);
  const b=bounds(panel);
  expect(b.min.y).toBeCloseTo(.14,5);
  expect(b.max.y).toBeCloseTo(1.68,5);
  const ray=new Raycaster(new Vector3(0,1,3),new Vector3(0,0,-1),0,6);
  for(const part of parts.filter(p=>p.motion!=='gate')){
   const mesh=new Mesh(part.geometry,part.material);mesh.position.fromArray(part.position);mesh.scale.fromArray(part.scale);mesh.rotation.set(...part.rotation);mesh.updateMatrixWorld();
   expect(ray.intersectObject(mesh).length,`static obstruction ${part.material.name}`).toBe(0);
  }
  library.dispose();
 });
 it('reuses parts and static geometry across entities and all eight city colors',()=>{
  const library=new MedievalBuildings(),first=library.get(entity('capital'),2)!;
  expect(library.get({...entity('capital'),id:99,x:90,progress:.2},2)).toBe(first);
  for(let owner=0;owner<8;owner++){
   const parts=library.get(entity('capital',owner),2)!;
   expect(parts.some(p=>`#${p.material.color.getHexString()}`===COLORS[owner])).toBe(true);
   expect(parts.filter(p=>!p.motion).map(p=>p.geometry)).toEqual(first.filter(p=>!p.motion).map(p=>p.geometry));
  }
  expect(library.get(entity('capital',NaN),NaN)).toBe(library.get(entity('capital'),1));
  expect(library.get(entity('capital',Infinity),Infinity)).toBe(library.get(entity('capital'),1));
  expect(library.get(entity('capital',999999),999999)).toBe(library.get(entity('capital',7),3));
  library.dispose();
 });
 it('uses local X wall runs, distinct reinforced masonry and a liftable gate',()=>{
  const library=new MedievalBuildings(),wall=library.get(entity('wall'),2)!,reinforced=library.get({...entity('wall'),wallTier:3},2)!;
  expect(bounds(wall).max.x-bounds(wall).min.x).toBeGreaterThan(.98);
  expect(bounds(wall).max.z-bounds(wall).min.z).toBeLessThan(.8);
  expect(bounds(reinforced).max.y).toBeGreaterThan(bounds(wall).max.y);
  expect(library.get(entity('gate'),2)!.some(p=>p.motion==='gate')).toBe(true);
  expect(library.get({...entity('house'),hp:0},2)).toBeUndefined();
  expect(library.get({...entity('house'),kind:'unit',type:'villager'},2)).toBeUndefined();
  library.dispose();
 });
 it('updates existing and future windows and releases each owned resource once',()=>{
  const library=new MedievalBuildings();library.updateLighting(0);
  const parts=library.get(entity('house'),3)!;
  const windows=parts.filter(p=>p.material.name==='medieval:glass');
  expect(windows.length).toBeGreaterThan(0);
  expect(windows.every(p=>p.material.emissiveIntensity>.3)).toBe(true);
  library.updateLighting(NaN);
  expect(windows.every(p=>Number.isFinite(p.material.emissiveIntensity))).toBe(true);
  const resources=new Set(parts.flatMap(p=>[p.geometry,p.material,...[p.material.map,p.material.bumpMap].filter(t=>t!==null)]));
  const counts=new Map<object,number>();for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)??0)+1));
  library.dispose();library.dispose();
  expect([...resources].every(r=>counts.get(r)===1)).toBe(true);
  expect(library.get(entity('house'),3)).toBeUndefined();
 });
 it('bounds the entire age, wall tier and city cache and releases every shared resource once',()=>{
  const library=new MedievalBuildings(),geometries=new Set(Object.values(library.shapes)),materials=new Set<ModelPart['material']>();
  for(const type of Object.keys(BUILDINGS) as BuildingType[])for(const age of [1,2,3])for(const tier of type==='wall'?[undefined,3 as const]:[undefined]){
   const first=library.get({...entity(type),wallTier:tier},age)!;
   for(let owner=0;owner<8;owner++){
    const parts=library.get({...entity(type,owner),wallTier:tier},age)!;
    expect(parts.map(p=>p.geometry)).toEqual(first.map(p=>p.geometry));
    expect(parts.some(p=>p.material.name===`medieval:team:${owner}`)).toBe(true);
    expect(library.get({...entity(type,owner),id:10000+owner,x:99,y:99,progress:.1,wallTier:tier},age)).toBe(parts);
    for(const part of parts){geometries.add(part.geometry);materials.add(part.material);}
   }
  }
  expect(geometries.size).toBeLessThan(600);expect(materials.size).toBeLessThan(30);
  const farm=library.get(entity('farm'),3)!;
  const triangles=farm.reduce((sum,p)=>sum+(p.geometry.index?.count??p.geometry.getAttribute('position').count)/3,0);
  expect(triangles,'decorative crops must fit an RTS scene budget').toBeLessThan(10000);
  const textures=new Set([...materials].flatMap(material=>[material.map,material.bumpMap].filter(t=>t!==null)));
  const resources=[...geometries,...materials,...textures],counts=new Map<object,number>();
  for(const resource of resources)resource.addEventListener('dispose',()=>counts.set(resource,(counts.get(resource)??0)+1));
  library.dispose();library.dispose();
  expect(resources.every(resource=>counts.get(resource)===1)).toBe(true);
 });
});
