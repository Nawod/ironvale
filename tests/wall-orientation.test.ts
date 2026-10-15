import {expect,it} from 'vitest';
import {InstancedMesh,Matrix4,Vector3} from 'three';
import {Battlefield} from '../src/render/battlefield';
import {createGame} from '../src/sim/world';
import {snapshot} from '../src/sim/visibility';
import type {BuildingType,Entity,Snapshot} from '../src/sim/types';

function site(id:number,x:number,y:number,type:BuildingType='palisade',extra:Partial<Entity>={}):Entity{
 return{id,kind:'building',type,x,y,owner:0,hp:250,maxHp:250,progress:1,queue:[],order:{kind:'idle'},path:[],cooldown:0,amount:0,stance:'hold',garrison:[],...extra};
}
function view(entities:Entity[]):Snapshot{return{...snapshot(createGame({opponents:1,difficulty:'easy',seed:42})),entities};}
function battlefield(entities:Entity[]){
 const field=new Battlefield({} as HTMLElement,{select:()=>{},action:()=>{},cancel:()=>{},error:()=>{}}) as any;
 field.app.screen={width:1200,height:900};field.center({x:23,y:23});field.update(view(entities));
 // Keep real models, projection, batching and instance transforms; only GPU submission is absent.
 field.renderer={render:()=>{},shadowMap:{enabled:false}};
 const axis=(id:number)=>{
  field.draw();
  for(const batch of field.batches.batches.values()){
   const i=batch.ids.indexOf(id);if(i<0||i>=batch.count)continue;
   const matrix=new Matrix4();(batch.mesh as InstancedMesh).getMatrixAt(i,matrix);
   const direction=new Vector3(1,0,0).transformDirection(matrix);
   return Math.abs(direction.z)>.9?'y':'x';
  }
  throw new Error(`No rendered instance for ${id}`);
 };
 const update=(entities:Entity[])=>field.update(view(entities));
 const dispose=()=>{field.batches.dispose();field.models.dispose();field.ring.dispose();field.bar.dispose();for(const material of field.barMaterials)material.dispose();field.preview.geometry.dispose();field.preview.material.dispose();field.projectileGeometry.dispose();field.projectileMaterial.dispose();};
 return{field,axis,update,dispose};
}

it.each(['palisade','wall'] as const)('rotates the actual %s instance to follow a north/south wall run',type=>{
 const render=battlefield([site(1,22,21,type),site(2,22,22,type),site(3,22,23,type)]);
 try{expect([1,2,3].map(render.axis)).toEqual(['y','y','y']);}finally{render.dispose();}
});

it('aligns every straight side of a rectangular enclosure and gives corners a stable X tie',()=>{
 const entities:Entity[]=[];let id=1;
 for(let y=20;y<=25;y++)for(let x=20;x<=26;x++)if(x===20||x===26||y===20||y===25)entities.push(site(id++,x,y));
 const render=battlefield(entities);
 try{for(const e of entities)expect(render.axis(e.id),`wall at ${e.x},${e.y}`).toBe(e.y===20||e.y===25?'x':'y');}finally{render.dispose();}
});

it.each(['x','y'] as const)('connects a two-tile gate to mixed wooden and stone walls along %s',axis=>{
 const entities=axis==='x'?[site(1,20,22),site(2,21,22,'gate'),site(3,23,22,'wall')]:[site(1,22,20),site(2,22,21,'gate'),site(3,22,23,'wall')];
 const render=battlefield(entities);
 try{expect([1,2,3].map(render.axis)).toEqual([axis,axis,axis]);}finally{render.dispose();}
});

it('ignores enemies, unrelated buildings and diagonal neighbors when aligning a wall',()=>{
 const render=battlefield([site(1,22,22),site(2,22,21,'wall',{owner:1}),site(3,22,23,'palisade',{owner:1}),site(4,23,23),site(5,22,24,'house')]);
 try{expect(render.axis(1)).toBe('x');}finally{render.dispose();}
});

it('uses same-owner known fog memories without requiring hidden world entities',()=>{
 const entities=[site(1,22,21,'palisade',{owner:1,ghost:true}),site(2,22,22,'wall',{owner:1,ghost:true}),site(3,22,23,'wall',{owner:1})],render=battlefield(entities);
 try{expect(render.axis(3)).toBe('y');}finally{render.dispose();}
});

it('includes construction sites while excluding destroyed segments from adjacency',()=>{
 const a=site(1,22,22),building=site(2,22,23,'wall',{progress:.08}),dead=site(3,23,22,'wall',{hp:0}),render=battlefield([a,building,dead]);
 try{expect(render.axis(1)).toBe('y');render.update([a,{...building,hp:0},dead]);expect(render.axis(1)).toBe('x');}finally{render.dispose();}
});

it('recomputes neighbors after removal, relocation and an upgrade without changing entity state',()=>{
 const a=site(1,22,22),b=site(2,22,23),render=battlefield([a,b]),before=structuredClone([a,b]);
 try{
  expect(render.axis(1)).toBe('y');render.update([a]);expect(render.axis(1)).toBe('x');
  render.update([a,{...b,x:23,y:22}]);expect(render.axis(1)).toBe('x');
  render.update([{...a,type:'wall',wallTier:3},b]);expect(render.axis(1)).toBe('y');
  expect([a,b]).toEqual(before);
 }finally{render.dispose();}
});

it('keeps junction ties deterministic when snapshot entity order changes',()=>{
 const entities=[site(1,22,22),site(2,21,22),site(3,23,22),site(4,22,21),site(5,22,23)],render=battlefield(entities);
 try{expect(render.axis(1)).toBe('x');render.update([...entities].reverse());expect(render.axis(1)).toBe('x');}finally{render.dispose();}
});

it('leaves isolated walls and ordinary buildings at their original X orientation',()=>{
 const render=battlefield([site(1,22,22),site(2,25,25,'house')]);
 try{expect([1,2].map(render.axis)).toEqual(['x','x']);}finally{render.dispose();}
});
