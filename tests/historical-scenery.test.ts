import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, DoubleSide, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HistoricalScenery } from '../src/render/historical-scenery3d';
import type { Entity } from '../src/sim/types';

const entity = (type = 'wood', id = 0, owner = 0) => ({ kind: 'resource', type, id, owner }) as Entity;
const file = (url: string) => readFile(resolve('public', url.replace(/^\.\//, '')));
const create = () => new HistoricalScenery(async url => {
 const data = await file(url); return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
}, async () => new Texture());

describe('compact original 0 A.D. natural scenery', () => {
 it('grounds three authentic textured silhouettes within tile budgets and retains leaf cutouts', async () => {
  const models = create(); await models.load(); expect(models.status, models.error).toBe('ready');
  const sources = new Set();
  for (let variant = 0; variant < 6; variant++) {
   const parts = models.get(entity(), 1, variant)!; const box = new Box3(); let triangles = 0;
   for (const p of parts) {
    box.union(p.geometry.boundingBox!); sources.add(p.geometry.userData.sourceAsset);
    triangles += (p.geometry.index?.count ?? p.geometry.getAttribute('position').count) / 3;
    expect([...p.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
    expect(p.geometry.getAttribute('uv').count).toBe(p.geometry.getAttribute('position').count);
    expect(p.material.map).toBeTruthy(); expect(p.material.transparent).toBe(false); expect(p.material.depthWrite).toBe(true);
   }
   expect(box.min.y).toBeCloseTo(0, 5); expect(box.max.y).toBeGreaterThan(2); expect(box.max.y).toBeLessThanOrEqual(4.01);
   expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)).toBeLessThanOrEqual(3.21);
   expect(triangles).toBeLessThan(3000);
   expect(parts.some(p => p.material.alphaTest >= .45 && p.material.side === DoubleSide)).toBe(true);
   expect(parts.some(p => p.material.alphaTest === 0)).toBe(true);
  }
  expect(sources.size).toBe(3);
  const berries = models.get(entity('berries'))!; expect(berries.length).toBeGreaterThan(0);
  const box = new Box3(); for (const p of berries) box.union(p.geometry.boundingBox!);
  expect(box.min.y).toBeCloseTo(0, 5); expect(box.max.y).toBeLessThanOrEqual(.96);
  for (const type of ['gold', 'stone', 'deer', 'cow', 'alpaca', 'fox']) expect(models.get(entity(type))).toBeUndefined();
  expect(models.get({ ...entity(), kind: 'building', type: 'house' })).toBeUndefined(); models.dispose();
 });

 it('prepares a bounded shared pool and never allocates for repeated entity requests', async () => {
  const models = create(); const pending = models.load(); expect(models.load()).toBe(pending); await pending;
  const before = models.metrics(); const first = models.get(entity())!;
  for (let id = 0; id < 10000; id++) {
   expect(models.get(entity('wood', id), 1, 0)).toBe(first);
   models.get(entity('wood', id), 1, id); models.get(entity('berries', id));
  }
  expect(models.metrics()).toEqual(before); expect(models.get(entity('wood', 0, 7))).toBe(first);
  expect(models.get(entity(), 1, NaN)).toBe(first);
  const disposals = new Map<object, ReturnType<typeof vi.spyOn>>();
  for (let i = 0; i < 6; i++) for (const p of models.get(entity(), 1, i)!) for (const resource of [p.geometry, p.material, p.material.map!]) if (!disposals.has(resource)) disposals.set(resource, vi.spyOn(resource, 'dispose'));
  models.dispose(); models.dispose(); for (const spy of disposals.values()) expect(spy).toHaveBeenCalledTimes(1);
  expect(models.metrics().geometries).toBe(0); expect(models.get(entity())).toBeUndefined();
 });

 it('keeps fallback available on failure and disposes sources arriving after teardown', async () => {
  const fail = new HistoricalScenery(async () => { throw new Error('missing'); }, async () => new Texture());
  await expect(fail.load()).rejects.toThrow('missing'); expect(fail.status).toBe('failed'); expect(fail.get(entity())).toBeUndefined();
  let release!: () => void; const gate = new Promise<void>(r => { release = r; }); const textureDisposals: number[] = [];
  const models = new HistoricalScenery(async url => { await gate; const data = await file(url); return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), ''); }, async () => { await gate; const texture = new Texture(), index = textureDisposals.length; textureDisposals.push(0); texture.addEventListener('dispose', () => { textureDisposals[index]++; }); return texture; });
  const pending = models.load(); models.dispose(); release(); await pending;
  expect(models.status).toBe('disposed'); expect(models.metrics().geometries).toBe(0); expect(textureDisposals).toEqual([1, 1, 1, 1]);
 });

 it('ships reproducible source and derivative hashes with the original license', async () => {
  const manifest = JSON.parse((await file('./models/historical-nature/manifest.json')).toString());
  expect(manifest.license).toBe('CC-BY-SA-3.0'); expect(manifest.revision).toBe('61a3b9507d974084e6badb88a0826bd89a6d5b8b');
  const { createHash } = await import('node:crypto');
  for (const record of manifest.assets) expect(createHash('sha256').update(await file(`./models/historical-nature/${record.file}`)).digest('hex')).toBe(record.sha256);
  expect((await file('./models/historical-nature/0ad-LICENSE.txt')).toString()).toContain('Creative Commons Attribution-Share Alike 3.0');
 });
});
