import { beforeAll, describe, expect, it, vi } from 'vitest';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { Entity } from '../src/sim/types';
import { ImportedScenery,SCENERY_ASSETS } from '../src/render/imported-scenery3d';
import type { ModelPart } from '../src/render/models3d';
import { BUILDINGS } from '../src/sim/definitions';

const entity = (type: string, kind = 'building', owner = 0) => ({ type, kind, owner, hp: 100 }) as Entity;
const bounds = (parts: ModelPart[]) => { const result = new Box3(); for (const p of parts) { p.geometry.computeBoundingBox(); result.union(p.geometry.boundingBox!); } return result; };
async function asset(url: string): Promise<GLTF> {
 const data = await readFile(resolve('public', url.replace(/^\.\//, '')));
 return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
}

describe('real imported realm assets', () => {
 it('ships natural scenery geometry locally', async () => {
  await expect(access(resolve('public/models/realm/CommonTree_1.glb'))).resolves.toBeUndefined();
 });
});

describe('shared imported scenery', () => {
 let models: ImportedScenery;
 beforeAll(async () => { models = new ImportedScenery(asset); await models.load(); });
 it('leaves every building and ruin to the previous model library and loads only natural scenery',()=>{
  for(const type of Object.keys(BUILDINGS))for(const hp of [0,100])expect(models.get({...entity(type),hp},3,0),type).toBeUndefined();
  expect(SCENERY_ASSETS.every(name=>/Tree|Bush|Rock|Mountain|Resource_Gold/.test(name))).toBe(true);
  for(const type of ['wood','berries','stone','gold'])expect(models.get(entity(type,'resource'),1,0)?.length).toBeGreaterThan(0);
 });
 it('grounds natural scenery and preserves finite source geometry',()=>{
  for(const type of ['wood','berries','stone','gold'])for(let variant=0;variant<5;variant++){
   const parts=models.get(entity(type,'resource'),1,variant)!;
   expect(bounds(parts).min.y).toBeCloseTo(0,4);
   for(const p of parts){expect(p.geometry.userData.importedScenery).toBe(true);expect([...p.geometry.getAttribute('position').array,...p.geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);}
  }
 });
 it('keeps berries recognizably fruitful and mountain variants within existing stone tiles', () => {
  const berries=models.get(entity('berries','resource'),1,0)!;
  expect(berries.some(p=>/Berry/i.test(p.material.name))).toBe(true);
  expect(bounds(berries).max.y).toBeGreaterThan(.25);
  for(let variant=0;variant<5;variant++) { const box=bounds(models.get(entity('stone','resource'),1,variant)!); expect(Math.max(box.max.x-box.min.x,box.max.z-box.min.z)).toBeLessThan(.961); expect(box.min.y).toBeCloseTo(0,4); }
  expect(models.get(entity('wood','resource'),1,0)![0].geometry).not.toBe(models.get(entity('wood','resource'),1,1)![0].geometry);
  expect(models.get(entity('farm'),1,0)).toBeUndefined(); expect(models.get(entity('gate'),1,0)).toBeUndefined(); expect(models.get(entity('deer','resource'),1,0)).toBeUndefined();
 });
 it('reuses geometry across entities and owners and releases resources exactly once', () => {
  const initial=models.get(entity('wood','resource'),2,0)!, before=models.stats();
  for(let id=0;id<1000;id++) expect(models.get({...entity('wood','resource'),id},2,0)).toBe(initial);
  expect(models.stats()).toEqual(before);
  const other=models.get(entity('wood','resource',1),2,0)!; expect(other[0].geometry).toBe(initial[0].geometry);
  const spies=[...new Set(initial.map(p=>p.geometry))].map(g=>vi.spyOn(g,'dispose'));
  models.dispose(); models.dispose(); expect(models.status).toBe('disposed'); for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1); expect(models.get(entity('capital'),1,0)).toBeUndefined(); expect(models.stats().bakedGeometries).toBe(0);
 });
 it('retains fallback on errors and disposes safely while a load is in flight', async () => {
  const fail=new ImportedScenery(async()=>{throw new Error('missing');}); await expect(fail.load()).rejects.toThrow('loading failed'); expect(fail.status).toBe('failed'); expect(fail.get(entity('house'),1,0)).toBeUndefined(); fail.dispose();
  let release!:()=>void; const gate=new Promise<void>(resolve=>{release=resolve;}); const pending=new ImportedScenery(async url=>{await gate;return asset(url);}); const load=pending.load(); pending.dispose(); release(); await load; expect(pending.status).toBe('disposed'); expect(pending.stats().bakedGeometries).toBe(0);
 });
 it('retains source vertex colors and UVs when baking material groups', async () => {
  const colored=new ImportedScenery(async()=>{
   const geometry=new BufferGeometry(); geometry.setAttribute('position',new Float32BufferAttribute([-.5,0,0,.5,0,0,0,1,.2],3)); geometry.setAttribute('color',new Float32BufferAttribute([1,.2,.1,.1,1,.2,.2,.1,1],3)); geometry.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,.5,1],2));
   const scene=new Group(); scene.add(new Mesh(geometry,new MeshStandardMaterial({name:'Wood',vertexColors:true}))); return {scene,animations:[]} as unknown as GLTF;
  }); await colored.load();
  for(const p of colored.get(entity('wood','resource'),1,0)!) {
   expect(p.material.vertexColors).toBe(true); expect(p.geometry.getAttribute('color')?.count).toBe(p.geometry.getAttribute('position').count); expect(p.geometry.getAttribute('uv')?.count).toBe(p.geometry.getAttribute('position').count);
  }
  colored.dispose();
 });
});
