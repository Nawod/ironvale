import {it,expect} from 'vitest';
import {RTSCamera} from '../src/render/camera3d';
import {terrainPixels} from '../src/render/terrain3d';
import {ModelLibrary} from '../src/render/models3d';
import {BUILDINGS,UNITS} from '../src/sim/definitions';
import {Battlefield} from '../src/render/battlefield';
import {vi} from 'vitest';
import {Scene,Object3D,InstancedMesh} from 'three';
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
