import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Color, Matrix4, Mesh, Object3D, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { ImportedScenery } from '../src/render/imported-scenery3d';
import { ModelLibrary, type ModelPart } from '../src/render/models3d';
import { ModelBatches } from '../src/render/batches3d';
import { RTSCamera } from '../src/render/camera3d';
import type { Entity } from '../src/sim/types';

const resource = (type: 'gold' | 'stone') => ({ kind: 'resource', type, owner: -1 }) as Entity;
async function asset(url: string): Promise<GLTF> {
 const data = await readFile(resolve('public', url.replace(/^\.\//, '')));
 return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
}
function bounds(parts: ModelPart[]): Box3 {
 const result = new Box3(), transform = new Object3D();
 for (const part of parts) {
  transform.position.fromArray(part.position); transform.scale.fromArray(part.scale); transform.rotation.set(...part.rotation); transform.updateMatrix();
  part.geometry.computeBoundingBox(); result.union(part.geometry.boundingBox!.clone().applyMatrix4(transform.matrix));
 }
 return result;
}
const brightOre = (part: ModelPart) => {
 const rgb = part.material.color.getRGB(new Color(), SRGBColorSpace);
 return rgb.r > .78 && rgb.g > .48 && rgb.b < .32 && rgb.r > rgb.g * 1.15;
};
function surfaceArea(parts: ModelPart[]): number {
 let result = 0;
 for (const part of parts) {
  const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 3) {
   const points = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(positions, i + offset).multiply(new Vector3(...part.scale)));
   result += points[1].sub(points[0]).cross(points[2].sub(points[0])).length() / 2;
  }
  if (geometry !== part.geometry) geometry.dispose();
 }
 return result;
}

describe('mineral identity at gameplay scale', () => {
 let imported: ImportedScenery;
 const fallback = new ModelLibrary();
 beforeAll(async () => { imported = new ImportedScenery(asset); await imported.load(); });
 afterAll(() => { imported.dispose(); fallback.dispose(); });

 // Catches tiny imported deposits, brown ore and a uniformly yellow fallback.
 it.each(['imported', 'fallback'])('%s gold has bright exposed ore on a substantial dark rock silhouette', source => {
  const gold = source === 'imported' ? imported.get(resource('gold'))! : fallback.get('gold', -1);
  const size = bounds(gold).getSize(new Vector3());
  expect(size.x).toBeGreaterThan(1.05); expect(size.y).toBeGreaterThan(.72);
  expect(Math.max(size.x, size.z)).toBeLessThan(1.4); expect(bounds(gold).min.y).toBeCloseTo(0, 4);
  const ore = gold.filter(brightOre);
  expect(ore.length).toBeGreaterThan(0);
  const fraction = surfaceArea(ore) / surfaceArea(gold);
  expect(fraction).toBeGreaterThan(.09); expect(fraction).toBeLessThan(.55);
  expect(bounds(ore).getSize(new Vector3()).x).toBeGreaterThan(.7);
  expect(gold.some(p => {
   const rgb = p.material.color.getRGB(new Color(), SRGBColorSpace);
   return rgb.r < .5 && rgb.g < .5 && rgb.b >= rgb.r * .95;
  })).toBe(true);
  const apron = gold.filter(p => bounds([p]).max.y <= .12);
  expect(apron.length).toBeGreaterThan(0);
  expect(bounds(apron).getSize(new Vector3()).x).toBeGreaterThan(.9);
  expect(gold.length).toBeLessThanOrEqual(5);
  expect(gold.every(p => p.geometry.type !== 'PlaneGeometry' && p.geometry.type !== 'TorusGeometry' && !p.material.transparent)).toBe(true);
 });

 it('keeps stone cool and free of gold-colored material', () => {
  const stone = [fallback.get('stone', -1), ...Array.from({ length: 5 }, (_, i) => imported.get(resource('stone'), 1, i)!)].flat();
  expect(stone.some(brightOre)).toBe(false);
  expect(stone.some(p => { const c = p.material.color; return c.b > c.r && c.b > c.g; })).toBe(true);
 });

 // Surface-area checks alone miss ore that is entirely buried in its host rock.
 it.each([0, Math.PI / 2, Math.PI, Math.PI * 1.5])('exposes gold to the camera at reduced gameplay zoom and yaw %f', yaw => {
  const gold = imported.get(resource('gold'))!, bright = new Set(gold.filter(brightOre).map(p => p.material));
  const meshes = gold.map(p => { const mesh = new Mesh(p.geometry, p.material); mesh.updateMatrixWorld(); return mesh; });
  const view = new RTSCamera(); view.configure({ width: 80, height: 80, focus: { x: 0, y: 0 }, zoom: .65, yaw, origin: .6 });
  const ray = new Raycaster(); let exposedOrePixels = 0, hostPixels = 0;
  for (let y = 0; y < 80; y += 2) for (let x = 0; x < 80; x += 2) {
   ray.setFromCamera(new Vector2(x / 40 - 1, 1 - y / 40), view.camera);
   const hit = ray.intersectObjects(meshes, false)[0];
   if (hit) { if (bright.has((hit.object as Mesh).material as ModelPart['material'])) exposedOrePixels += 4; else hostPixels += 4; }
  }
  expect(exposedOrePixels).toBeGreaterThanOrEqual(28);
  expect(hostPixels).toBeGreaterThan(exposedOrePixels);
 });

 it('shares the ore geometry across entities and preserves mesh picking and disposal', () => {
  const gold = imported.get(resource('gold'))!, initial = imported.stats();
  for (let id = 0; id < 1000; id++) expect(imported.get({ ...resource('gold'), id }, 1, id)).toBe(gold);
  expect(imported.stats()).toEqual(initial);
  const scene = new Scene(), batches = new ModelBatches(scene);
  for (const part of gold) batches.add(part, new Matrix4(), 0xffffff, 0, 0, false, false, false, 73);
  batches.end();
  expect(batches.pick(new Raycaster(new Vector3(0, 5, 0), new Vector3(0, -1, 0)))).toBe(73);
  batches.dispose();
  const disposed = gold.map(p => vi.spyOn(p.geometry, 'dispose'));
  imported.dispose(); imported.dispose();
  for (const spy of disposed) expect(spy).toHaveBeenCalledTimes(1);
 });
});
