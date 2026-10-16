import {expect,test} from 'vitest';
import {Scene,InstancedMesh,Matrix4,Vector3} from 'three';
import {BattleEffects,projectilePose,turnToward} from '../src/render/battle-effects3d';

test('arrows and siege stones follow distinct arcs with a forward tangent and finite endpoints',()=>{
 const from={x:1,y:2,height:1.5},target={x:9,y:2};
 const start=projectilePose(from,target,0,false),arrow=projectilePose(from,target,.5,false),stone=projectilePose(from,target,.5,true),end=projectilePose(from,target,1,false);
 expect(start.position).toEqual(new Vector3(1,1.5,2));expect(end.position.x).toBe(9);expect(end.position.y).toBeCloseTo(.15);expect(arrow.position.y).toBeLessThan(stone.position.y);expect(arrow.direction.x).toBeGreaterThan(0);
 expect(projectilePose(from,{x:1,y:2},.5,false).direction.length()).toBeCloseTo(1);
});
test('facing turns across the short angular arc without snapping',()=>{
 const angle=turnToward(Math.PI-.05,-Math.PI+.05,.016);expect(Math.abs(angle-(Math.PI-.05))).toBeLessThan(.1);expect(Math.cos(angle)).toBeLessThan(-.99);expect(turnToward(0,Math.PI/2,0)).toBe(0);
});
test('projectiles are pooled, retain their release origin, expire, and dispose bounded resources',()=>{
 const scene=new Scene(),effects=new BattleEffects(scene,2),fx={id:1,type:'archer' as const,attackFx:{x:10,y:10,tick:100}};
 try{
  effects.begin(110);effects.add(fx,{x:1,y:1},1.4);effects.add({...fx,id:2},{x:2,y:2},1.4);effects.add({...fx,id:3},{x:3,y:3},1.4);effects.end();
  const arrows=scene.children.find(c=>c.name==='Battle arrows') as InstancedMesh;expect(arrows.count).toBe(2);const matrix=new Matrix4();arrows.getMatrixAt(0,matrix);const a=new Vector3().setFromMatrixPosition(matrix);
  effects.begin(110);effects.add(fx,{x:7,y:7},1.4);effects.end();arrows.getMatrixAt(0,matrix);expect(new Vector3().setFromMatrixPosition(matrix)).toEqual(a);
  effects.begin(130);effects.add(fx,{x:7,y:7},1.4);effects.end();expect(arrows.count).toBe(0);
 }finally{effects.dispose();}expect(scene.children).toHaveLength(0);
});
