import {expect,test,vi} from 'vitest';
import {InstancedMesh,Matrix4,Scene,Vector3,MeshStandardMaterial} from 'three';
import {BattleEffects,directProjectilePose} from '../src/render/battle-effects3d';
import type {UnitType} from '../src/sim/types';

const mesh=(scene:Scene,name:string)=>scene.children.find(c=>c.name===name) as InstancedMesh;
const shot=(type:UnitType,id=1)=>({id,type,attackFx:{x:10,y:0,tick:100}});
test('lead bullets and cannonballs travel directly while Dandu bolts use an independent shallow trajectory',()=>{
 const from={x:0,y:0,height:1.2},target={x:10,y:0};
 expect(directProjectilePose(from,target,.5,'bullet').position.y).toBeCloseTo(.675);
 expect(directProjectilePose(from,target,.5,'cannonball').position.y).toBeCloseTo(.675);
 expect(directProjectilePose(from,target,.5,'bolt').position.y).toBeGreaterThan(.675);
 expect(directProjectilePose(from,target,1,'bullet',3).position.y).toBeCloseTo(3.15);
 expect(directProjectilePose(from,{x:0,y:0},.5,'bullet',1.05).direction.length()).toBeCloseTo(1);
});
test('gunmen produce brief flashes and lead projectiles, cannons balls and smoke, and aircraft separate bolts',()=>{
 const scene=new Scene(),effects=new BattleEffects(scene,2);
 try{
  effects.begin(100);effects.add(shot('musketeer'),{x:0,y:0},1.1);effects.add(shot('rifleman',2),{x:1,y:0},1.1);effects.end();
  expect(mesh(scene,'Battle lead bullets').count).toBe(2);expect(mesh(scene,'Battle bullet tracers').count).toBe(2);expect(mesh(scene,'Battle muzzle flashes').count).toBe(2);expect(mesh(scene,'Battle arrows').count).toBe(0);
  effects.begin(102);effects.add(shot('musketeer'),{x:0,y:0},1.1);effects.end();expect(mesh(scene,'Battle muzzle flashes').count).toBe(0);
  effects.begin(100);effects.add(shot('cannon'),{x:0,y:0},.88);effects.add(shot('danduMonara',2),{x:1,y:0},3.5);effects.end();
  expect(mesh(scene,'Battle cannonballs').count).toBe(1);expect(mesh(scene,'Battle gun smoke').count).toBe(1);expect(mesh(scene,'Battle Dandu bolts').count).toBe(1);expect(mesh(scene,'Battle siege stones').count).toBe(0);
  const matrix=new Matrix4();mesh(scene,'Battle Dandu bolts').getMatrixAt(0,matrix);expect(new Vector3().setFromMatrixPosition(matrix).y).toBeCloseTo(3.5);
  effects.begin(120);effects.add(shot('cannon'),{x:0,y:0},.88);effects.add(shot('danduMonara',2),{x:1,y:0},3.5);effects.end();expect(scene.children.every(c=>(c as InstancedMesh).count===0)).toBe(true);
 }finally{effects.dispose();}
});
test('new effects keep frozen shot origins, never exceed their pool caps and dispose shared resources once',()=>{
 const scene=new Scene(),effects=new BattleEffects(scene,1);const geoms=scene.children.map(c=>vi.spyOn((c as InstancedMesh).geometry,'dispose')),materials=scene.children.map(c=>vi.spyOn((c as InstancedMesh).material as MeshStandardMaterial,'dispose'));
 effects.begin(101);effects.add(shot('musketeer'),{x:0,y:0},1.1);effects.add(shot('rifleman',2),{x:3,y:0},1.1);effects.end();
 const matrix=new Matrix4(),bullets=mesh(scene,'Battle lead bullets');expect(bullets.count).toBe(1);bullets.getMatrixAt(0,matrix);const before=matrix.clone();
 effects.begin(101);effects.add(shot('musketeer'),{x:7,y:7},2);effects.end();bullets.getMatrixAt(0,matrix);expect(matrix).toEqual(before);
 effects.dispose();effects.dispose();expect(scene.children).toHaveLength(0);expect(geoms.every(spy=>spy.mock.calls.length===1)).toBe(true);expect(materials.every(spy=>spy.mock.calls.length===1)).toBe(true);
});
