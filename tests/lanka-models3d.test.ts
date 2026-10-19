import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Object3D, Texture } from 'three';
import { LankaModels } from '../src/render/lanka-models3d';
import { LankaArchitecture } from '../src/render/lanka-architecture3d';
import type { Entity } from '../src/sim/types';
import type { ModelPart } from '../src/render/models3d';

const idle = {time: 0, moving: false, attacking: false, working: false};
const unit = (type: string, id=1, owner=0) => ({kind:'unit', type, id, owner, hp:100}) as Entity;
const file = (url:string) => readFile(resolve('public',url.replace(/^\.\//,'')));
const create = () => new LankaModels(async url=>JSON.parse((await file(url)).toString()),async url=>{const b=await file(url);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},async()=>new Texture());
const bounds = (parts:ModelPart[]) => {const box=new Box3(), transform=new Object3D();for(const p of parts){transform.position.fromArray(p.position);transform.scale.fromArray(p.scale);transform.rotation.set(...p.rotation);transform.updateMatrix();p.geometry.computeBoundingBox();box.union(p.geometry.boundingBox!.clone().applyMatrix4(transform.matrix));}return box;};

describe('Kingdom Lanka shared visual bank',()=>{
 it('renders six unmistakable new unit silhouettes and native textured infantry',async()=>{
  const models=create();await models.load();expect(models.status,models.error).toBe('ready');
  for(const type of ['warElephant','champion','musketeer','rifleman','cannon','danduMonara','spearman','swordsman','archer','pikeman']){
   const parts=models.get(unit(type),'anuradhapura',idle)!;expect(parts?.length,type).toBeGreaterThan(0);
   expect(parts.every(p=>[...p.geometry.getAttribute('position').array].every(Number.isFinite))).toBe(true);
  }
  const elephant=bounds(models.get(unit('warElephant'),'anuradhapura',idle)!);expect(elephant.max.y).toBeGreaterThan(2.5);expect(elephant.min.y).toBeGreaterThan(-.06);
  const walkA=models.get(unit('warElephant'),'anuradhapura',{...idle,moving:true})![0].geometry,walkB=models.get(unit('warElephant'),'anuradhapura',{...idle,moving:true,time:.4})![0].geometry;
  expect(walkA).not.toBe(walkB);expect([...walkA.getAttribute('position').array]).not.toEqual([...walkB.getAttribute('position').array]);
  const craft=bounds(models.get(unit('danduMonara'),'ravana',idle)!);expect(craft.max.x-craft.min.x).toBeGreaterThan(4);expect(craft.min.y).toBeGreaterThan(-1);
  const ordinary=bounds(models.get(unit('champion'),'kandy',idle)!), giant=bounds(models.get(unit('champion'),'ravana',idle)!);expect(giant.max.y).toBeGreaterThan(ordinary.max.y*1.35);
  expect(models.get(unit('cannon'),'dutch',idle)!.some(p=>p.material.userData.lankaRole==='barrel')).toBe(true);
  expect(models.get(unit('rifleman'),'british',idle)).not.toBe(models.get(unit('musketeer'),'portuguese',idle));
  expect(models.get(unit('spearman'),'kandy',idle)!.some(p=>p.material.map)).toBe(true);
  const manifest=JSON.parse((await file('./models/lanka/manifest.json')).toString());
  expect(manifest.license).toBe('CC-BY-SA-3.0');expect(manifest.sources.some((s:{path:string})=>s.path==='meshes/skeletal/elephant_asian_male.dae')).toBe(true);
  expect(manifest.sources.every((s:{sha256:string;url:string})=>s.sha256.length===64&&s.url.includes('61a3b950'))).toBe(true);
  models.dispose();
 });
 it('shares owner geometry, preserves city materials and excludes zombies; lookup and disposal stay bounded',async()=>{
  const models=create();await models.load();const a=models.get(unit('cannon'),'dutch',idle)!,b=models.get(unit('cannon',1,1),'dutch',idle)!;
  expect(a[0].geometry).toBe(b[0].geometry);expect(a.some((p,i)=>p.material!==b[i].material)).toBe(true);
  const before=models.metrics();expect(before.geometryBytes).toBeLessThan(50_000_000);expect(before.geometries).toBeLessThan(2500);for(let i=0;i<4000;i++)models.get(unit(['cannon','musketeer','warElephant','danduMonara'][i%4],i,i%8),'ravana',{...idle,time:i/20,moving:true});
  expect(models.metrics()).toEqual(before);expect(models.get(unit('zombie'),'ravana',idle)).toBeUndefined();
  const geom=a[0].geometry,dispose=vi.spyOn(geom,'dispose'),material=vi.spyOn(a[0].material,'dispose');models.dispose();models.dispose();expect(dispose).toHaveBeenCalledTimes(1);expect(material).toHaveBeenCalledTimes(1);expect(models.metrics().geometries).toBe(0);expect(models.get(unit('cannon'),'dutch',idle)).toBeUndefined();
 });
 it('provides four original architecture families with city-specific silhouettes without replacing functional buildings',()=>{
  const buildings=new LankaArchitecture(),e={kind:'building',type:'capital',owner:0,hp:100} as Entity;
  const all=['anuradhapura','polonnaruwa','kandy','chola','elara','jaffna','portuguese','dutch','british','ravana'].map(id=>buildings.get(e,id,3)!);
  expect(all.every(parts=>parts?.length>0)).toBe(true);expect(new Set(all.map(parts=>parts[0].geometry)).size).toBe(10);
  const before=buildings.metrics();for(let i=0;i<2000;i++)buildings.get({...e,id:i},'kandy',3);expect(buildings.metrics()).toEqual(before);
  expect(buildings.get({...e,type:'wall'},'ravana',3)).toBeUndefined();buildings.dispose();expect(buildings.metrics().geometries).toBe(0);
 });
 it('releases textures when a battlefield closes during the asynchronous native load',async()=>{
  let resume!:()=>void;const gate=new Promise<void>(r=>{resume=r;}),textures:Texture[]=[];
  const models=new LankaModels(async url=>JSON.parse((await file(url)).toString()),async url=>{const b=await file(url);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},async()=>{const t=new Texture();vi.spyOn(t,'dispose');textures.push(t);await gate;return t;});
  const pending=models.load();await vi.waitFor(()=>expect(textures.length).toBeGreaterThan(0));models.dispose();resume();await pending;
  expect(models.status).toBe('disposed');expect(models.metrics().geometries).toBe(0);expect(models.metrics().textures).toBe(0);expect(textures.every(t=>vi.mocked(t.dispose).mock.calls.length===1)).toBe(true);
 });
});
