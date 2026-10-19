import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Texture } from 'three';
import { HistoricalModels } from '../src/render/historical-models3d';
import type { Entity } from '../src/sim/types';

const idle = { time: 0, moving: false, working: false, attacking: false };
const entity = (type = 'spearman', id = 1, owner = 0) => ({ type, id, owner, kind: 'unit' }) as Entity;
const file = (url: string) => readFile(resolve('public', url.replace(/^\.\//, '')));
const create = () => new HistoricalModels(async url => JSON.parse((await file(url)).toString()), async url => {
 const data = await file(url); return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}, async () => new Texture());

describe('historical 0 A.D. shared character pack', () => {
 it('ships attributed original body, face and equipment derivatives with actual animated poses', async () => {
  const models = create(); await models.load(); expect(models.status, models.error).toBe('ready');
  for (const type of ['spearman', 'pikeman', 'swordsman', 'archer']) {
   const a = models.get(entity(type), { ...idle, moving: true })!;
   const b = models.get(entity(type), { ...idle, moving: true, time: .4 })!;
   expect(a.length).toBeGreaterThanOrEqual(3);
   expect([...a[0].geometry.getAttribute('position').array]).not.toEqual([...b[0].geometry.getAttribute('position').array]);
   let bottom = Infinity, top = -Infinity;
   for (const part of a) {
    expect([...part.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
    expect(part.geometry.getAttribute('uv').count).toBe(part.geometry.getAttribute('position').count);
    expect(part.geometry.userData.historicalActor).toBe(true);
    bottom = Math.min(bottom, part.geometry.boundingBox!.min.y); top = Math.max(top, part.geometry.boundingBox!.max.y);
   }
   expect(bottom).toBeGreaterThan(-.12); expect(top).toBeGreaterThan(1.4); expect(top).toBeLessThan(4.5);
  }
  const manifest = JSON.parse((await file('./models/historical/manifest.json')).toString());
  expect(manifest.license).toBe('CC-BY-SA-3.0'); expect(manifest.sources.length).toBeGreaterThan(15);
  expect(manifest.sources.every((s: { sha256: string; url: string }) => s.sha256.length === 64 && s.url.includes('61a3b950'))).toBe(true);
  models.dispose();
 });

 it('shares bounded geometry across owners, selects three stable variants, and excludes zombies and mounts', async () => {
  const models = create(); await models.load(); const before = models.metrics();
  const a = models.get(entity(), idle)!, other = models.get(entity('spearman', 1, 1), idle)!;
  expect(a[0].geometry).toBe(other[0].geometry); expect(a[0].material).not.toBe(other[0].material);
  expect(models.get(entity(), idle)).toBe(a);
  expect(new Set([1, 2, 3].map(id => models.get(entity('spearman', id), idle)![0].material)).size).toBe(3);
  for (let id = 0; id < 1000; id++) models.get(entity('spearman', id, id % 8), { ...idle, time: id / 10, moving: true });
  expect(models.metrics().geometries).toBe(before.geometries); expect(models.metrics().liveMixers).toBe(0);
  expect(models.metrics().geometryBytes).toBeLessThan(20_000_000);
  expect(models.metrics().textures).toBeLessThanOrEqual(18);
  expect(models.get(entity('zombie'), idle)).toBeUndefined(); expect(models.get(entity('cavalry'), idle)).toBeUndefined();
  models.dispose(); expect(models.metrics().geometries).toBe(0); expect(models.get(entity(), idle)).toBeUndefined();
 });

 it('equips pikemen with the native long sarissa and their own two-handed pose bank', async () => {
  const models = create(); await models.load();
  const spear = models.get(entity('spearman'), idle)!;
  const pike = models.get(entity('pikeman'), idle)!;
  expect(pike[0].geometry).not.toBe(spear[0].geometry);
  const reach = (parts: typeof pike) => {
   const weapon = parts.find(part => part.material.userData.historicalRole === 'weapon')!;
   const b = weapon.geometry.boundingBox!; return b.max.distanceTo(b.min);
  };
  expect(reach(pike)).toBeGreaterThan(reach(spear) * 1.3);
  models.dispose();
 });

 it('releases decoded textures if the battlefield is disposed during loading', async () => {
  let resume!: () => void; const gate = new Promise<void>(resolve => { resume = resolve; });
  const textures: Texture[] = [];
  const models = new HistoricalModels(async url => JSON.parse((await file(url)).toString()), async url => {
   const data = await file(url); return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }, async () => { const texture = new Texture(); vi.spyOn(texture, 'dispose'); textures.push(texture); await gate; return texture; });
  const pending = models.load();
  await vi.waitFor(() => expect(textures.length).toBeGreaterThan(0));
  models.dispose(); resume(); await pending;
  expect(models.status).toBe('disposed'); expect(models.metrics().textures).toBe(0);
  expect(textures.every(texture => vi.mocked(texture.dispose).mock.calls.length === 1)).toBe(true);
 });

 it('reuses two native pose phases for crowds while retaining all eight full-detail samples', async () => {
  const models = create(); await models.load(); const before = models.metrics();
  const bank = JSON.parse((await file('./models/historical/characters.json')).toString());
  for (const type of ['spearman', 'swordsman', 'archer', 'pikeman']) for (const action of ['idle', 'walk', 'work', 'attack']) {
   const duration = bank.sets[type].cycles[action].duration;
   const full = new Set(), crowd = new Set();
   for (let sample = 0; sample < 100; sample++) {
    const options = { time: duration * sample / 100, moving: action === 'walk', working: action === 'work', attacking: action === 'attack' };
    const normal = models.get(entity(type), options)!, distant = models.get(entity(type), { ...options, detail: 'crowd' })!;
    full.add(normal[0].geometry); crowd.add(distant[0].geometry);
    expect(distant.map(part => part.material)).toEqual(normal.map(part => part.material));
   }
   expect(full.size, `${type}:${action}`).toBe(8); expect(crowd.size, `${type}:${action}`).toBe(2);
   expect([...crowd].every(geometry => full.has(geometry))).toBe(true);
  }
  expect(models.metrics()).toEqual(before); models.dispose();
 });

 it('uses the authored head prop correction so the face points forward with the body', async () => {
  const models = create(); await models.load();
  const head = models.get(entity('spearman', 0), idle)!.find(part => part.material.userData.historicalRole === 'head')!;
  const uv = head.geometry.getAttribute('uv'), position = head.geometry.getAttribute('position');
  const nearest = (u: number, v: number) => {
   let index = 0, distance = Infinity;
   for (let i = 0; i < uv.count; i++) { const d = Math.hypot(uv.getX(i) - u, uv.getY(i) - v); if (d < distance) { index = i; distance = d; } }
   return index;
  };
  // Original Celtic head UV landmarks: nose tip and rear hair line.
  expect(position.getZ(nearest(.00199127, .4783726))).toBeGreaterThan(position.getZ(nearest(1, .04885065)));
  expect(position.getY(nearest(.4728909, .994672))).toBeGreaterThan(position.getY(nearest(1, .04885065)));
  models.dispose();
 });
});
