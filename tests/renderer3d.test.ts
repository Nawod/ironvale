import {it,expect} from 'vitest';
import {RTSCamera} from '../src/render/camera3d';
import {terrainPixels} from '../src/render/terrain3d';
import {ModelLibrary} from '../src/render/models3d';
import {BUILDINGS,UNITS} from '../src/sim/definitions';
import {Battlefield} from '../src/render/battlefield';
import {vi} from 'vitest';
import {Scene,Object3D,InstancedMesh,Texture} from 'three';
import {ModelBatches} from '../src/render/batches3d';
it.each([0,Math.PI/4,Math.PI/2,Math.PI])('projects and picks the same ground point at rotation %f',yaw=>{
 const camera=new RTSCamera();camera.configure({width:900,height:600,focus:{x:22,y:31},zoom:1.1,yaw,origin:.42});const p={x:25,y:29},screen=camera.project(p),back=camera.ground(screen);expect(back.x).toBeCloseTo(p.x,6);expect(back.y).toBeCloseTo(p.y,6);
});
it('matches the original default isometric projection',()=>{
 const camera=new RTSCamera();camera.configure({width:900,height:600,focus:{x:0,y:0},zoom:1,yaw:Math.PI/4,origin:.42});expect(camera.project({x:2,y:1}).x).toBeCloseTo(482,6);expect(camera.project({x:2,y:1}).y).toBeCloseTo(300,6);
});
it('has real mesh parts for every building, troop and resource',()=>{
 const models=new ModelLibrary();try{for(const type of [...Object.keys(BUILDINGS),...Object.keys(UNITS),'wood','gold','stone','deer']){const parts=models.get(type as any,0);expect(parts.length).toBeGreaterThan(0);expect(parts.every(p=>p.geometry.attributes.position.count>0)).toBe(true);}expect(models.get('villager',0)).toBe(models.get('villager',0));expect(models.get('villager',0).some(p=>p.motion==='legL')).toBe(true);}finally{models.dispose();}
});
it('uses smooth anatomy, textured surfaces and compact merged scenery',()=>{const models=new ModelLibrary();try{const human=models.get('villager',0),deer=models.get('deer',-1),tree=models.get('wood',-1);expect(human.some(p=>p.motion==='legL'&&p.geometry.type!=='BoxGeometry')).toBe(true);expect(deer.some(p=>p.motion==='legL'&&p.geometry.type!=='BoxGeometry')).toBe(true);expect(models.get('house',0).some(p=>p.material.map!==null)).toBe(true);expect(tree.some(p=>p.geometry.type==='ConeGeometry')).toBe(false);expect(models.get('capital',0).length).toBeLessThan(18);}finally{models.dispose();}});
it('renders distinct woodland silhouettes and a low fruit-bearing shrub',()=>{const models=new ModelLibrary();try{const trees=[0,1,2,3].map(variant=>models.get('wood',-1,variant));expect(new Set(trees.map(parts=>parts)).size).toBe(4);expect(new Set(trees.map(parts=>parts.map(p=>p.geometry.uuid).join(','))).size).toBe(4);const berries=models.get('berries',-1),top=Math.max(...berries.map(p=>{p.geometry.computeBoundingBox();return p.position[1]+(p.geometry.boundingBox?.max.y??0)*p.scale[1];}));expect(top).toBeLessThan(1.3);expect(berries.some(p=>p.material.color.r>p.material.color.g*1.4)).toBe(true);}finally{models.dispose();}});
it('maps pine foliage only to needles in the source atlas',()=>{
 const models=new ModelLibrary(),texture=new Texture();try{models.setNaturalTextures(new Map([['twig_diff',texture],['twig_alpha',texture]]));const foliage=models.get('wood',-1,2).find(part=>part.material.alphaMap===texture)!;const uv=foliage.geometry.getAttribute('uv');for(let i=0;i<uv.count;i++){expect(uv.getX(i)).toBeLessThan(.21);expect(uv.getY(i)).toBeGreaterThan(.61);}}finally{models.dispose();texture.dispose();}
});

it('maps visible northern tiles to northern plane UVs without leaking fog',()=>{
 const bytes=terrainPixels({size:2,terrain:[0,0,0,0],fog:[2,1,0,0]});expect([...bytes.slice(0,3)]).toEqual([22,37,30]);expect([...bytes.slice(8,11)]).toEqual([91,119,74]);expect(bytes[12]).toBeLessThan(bytes[8]);expect(bytes[15]).toBe(255);
});
it.each([0,Math.PI/2,Math.PI])('pans with the screen drag at rotation %f',yaw=>{
 const field=new Battlefield({} as HTMLElement,{select:vi.fn(),action:vi.fn(),cancel:vi.fn(),error:vi.fn()}) as any;
 field.app.screen={width:900,height:600};field.center({x:22,y:31});field.rotate(yaw-Math.PI/4);field.zoom=1.2;
 const before=field.worldToScreen({x:25,y:29});field.panScreen(45,-23);const after=field.worldToScreen({x:25,y:29});expect(after.x-before.x).toBeCloseTo(45,6);expect(after.y-before.y).toBeCloseTo(-23,6);field.models.dispose();
});
it('retains unchanged instance colors and updates them when fog changes',()=>{
 const scene=new Scene(),models=new ModelLibrary(),batches=new ModelBatches(scene),root=new Object3D(),part=models.get('villager',0)[0];root.updateMatrix();
 const draw=(tint:number)=>{batches.begin();batches.add(part,root.matrix,tint,0,0,false,false,false,1);batches.end();};
 try{draw(0xffffff);const mesh=scene.children[0] as InstancedMesh,version=mesh.instanceColor!.version;draw(0xffffff);expect(mesh.instanceColor!.version).toBe(version);draw(0x697466);expect(mesh.instanceColor!.version).toBeGreaterThan(version);}finally{batches.dispose();models.dispose();}
});
it('can reduce actor shadow work without removing scenery shadows or actor picking',()=>{
 const scene=new Scene(),models=new ModelLibrary(),batches=new ModelBatches(scene),root=new Object3D();root.updateMatrix();
 const actor=models.get('villager',0)[0],scenery=models.get('wood',-1)[0];actor.geometry.userData.importedActor=true;
 try{
  batches.setActorShadows(false);batches.begin();batches.add(actor,root.matrix,0xffffff,0,0,false,false,false,42);batches.add(scenery,root.matrix,0xffffff,0,0,false,false,false,43);batches.end();
  const meshes=scene.children as InstancedMesh[];
  expect(meshes.find(m=>m.geometry===actor.geometry)!.castShadow).toBe(false);
  expect(meshes.find(m=>m.geometry===actor.geometry)!.receiveShadow).toBe(false);
  expect(meshes.find(m=>m.geometry===scenery.geometry)!.castShadow).toBe(true);
  expect(meshes.every(m=>m.visible&&m.count===1)).toBe(true);
  batches.setActorShadows(true);expect(meshes.every(m=>m.castShadow&&m.receiveShadow)).toBe(true);
 }finally{batches.dispose();models.dispose();}
});
it('gives touch input a small target margin around visible food without selecting fog memories',()=>{
 const field=new Battlefield({} as HTMLElement,{select:vi.fn(),action:vi.fn(),cancel:vi.fn(),error:vi.fn()}) as any;
 field.app.screen={width:390,height:664};field.ready=true;field.center({x:17,y:22});
 const bush={id:12,kind:'resource',type:'berries',x:14,y:20,amount:150,ghost:false};field.snapshot={entities:[bush]};
 const point=field.view.project(bush,.45);point.y+=9;
 try{expect(field.hit(point)).toBeUndefined();expect(field.hit(point,true)?.id).toBe(12);bush.ghost=true;expect(field.hit(point,true)).toBeUndefined();bush.ghost=false;bush.amount=0;expect(field.hit(point,true)).toBeUndefined();}finally{field.models.dispose();field.batches.dispose();}
});
