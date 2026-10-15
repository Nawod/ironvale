import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Color, MeshStandardMaterial } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { ImportedModels } from '../src/render/imported-models3d';
import { ModelLibrary } from '../src/render/models3d';
import { COLORS } from '../src/sim/definitions';
import type { Entity } from '../src/sim/types';

const zombie = (id = 0, owner = -2) => ({ id, owner, type: 'zombie', kind: 'unit' }) as Entity;
const idle = { time: 0, moving: false, working: false, attacking: false };

// Read shipped GLBs, retaining real vertex palettes and animations without a browser decoder.
async function geometryAsset(url: string): Promise<GLTF> {
 const bytes = await readFile(resolve('public', url)), length = bytes.readUInt32LE(12);
 const json = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')), offset = 20 + length + 8;
 json.buffers = [{ uri: `data:application/octet-stream;base64,${bytes.subarray(offset).toString('base64')}`, byteLength: bytes.length - offset }];
 for (const material of json.materials ?? []) {
  delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture;
  delete material.pbrMetallicRoughness?.baseColorTexture; delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
 }
 delete json.images; delete json.textures;
 globalThis.ProgressEvent ??= class extends Event { readonly lengthComputable = false; readonly loaded = 0; readonly total = 0; } as typeof ProgressEvent;
 return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

describe('shared undead actor appearance', () => {
 let models: ImportedModels;
 beforeAll(async () => { models = new ImportedModels(geometryAsset); await models.load(); }, 30000);
 afterAll(() => models.dispose());

 it('renders real finite grounded human anatomy and mottled undead skin in both detail banks', () => {
  for (const detail of ['full', 'crowd'] as const) {
   const parts = models.get(zombie(), { ...idle, detail });
   expect(parts).toBeDefined(); expect(parts!.length).toBeGreaterThan(1);
   const skin = parts!.find(p => p.material.name === 'Undead skin')!;
   expect(skin).toBeDefined(); expect(skin.material.color.g).toBeGreaterThan(skin.material.color.r);
   const colors = skin.geometry.getAttribute('color');
   expect(new Set(Array.from(colors.array)).size).toBeGreaterThan(8);
   for (const p of parts!) {
    const position = p.geometry.getAttribute('position'), normal = p.geometry.getAttribute('normal');
    expect(position.count).toBeGreaterThan(0); expect(normal.count).toBe(position.count);
    expect([...position.array, ...normal.array, ...p.geometry.getAttribute('color').array].every(Number.isFinite)).toBe(true);
    expect(p.geometry.index!.count).toBeGreaterThan(0);
    expect(p.material.name).not.toBe('City cloth');
    expect(p.geometry.userData.importedAttachment).not.toBe(true);
   }
   expect(Math.min(...parts!.map(p => p.geometry.boundingBox!.min.y))).toBeCloseTo(0, 5);
   expect(Math.max(...parts!.map(p => p.geometry.boundingBox!.max.y))).toBeGreaterThan(1);
   const maxSkinZ = skin.geometry.boundingBox!.max.z;
   expect(maxSkinZ, 'reaching hands project forward from the torso').toBeGreaterThan(.45);
  }
 });

 it('shares neutral geometry and materials across owners and IDs without adding entity resources', () => {
  const baseline = models.get(zombie(), idle)!, before = models.stats();
  expect(baseline).toBeDefined();
  for (let id = 0; id < 800; id++) {
   const parts = models.get(zombie(id, id % 11 - 2), idle)!;
   expect(parts).toBe(baseline);
  }
  expect(models.stats()).toEqual(before);
  const cityColors = new Set(COLORS.map(color => new Color(color).getHexString()));
  const cloth = baseline.find(p => p.material.name === 'Leather and trim')!;
  expect(cloth).toBeDefined(); expect(cityColors.has(cloth.material.color.getHexString())).toBe(false);
  const colors = cloth.geometry.getAttribute('color');
  for (let i = 0; i < colors.count; i++) {
   const actual = new Color().setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)).multiply(cloth.material.color);
   expect(Math.max(actual.r, actual.g, actual.b), 'cloth remains dark and weathered').toBeLessThan(.08);
   expect(cityColors.has(actual.getHexString())).toBe(false);
  }
  for (let owner = 0; owner < 8; owner++) {
   const city = models.get({ ...zombie(), type: 'villager', owner }, idle)!;
   expect(city.find(p => p.material.name === 'Skin')!.material).not.toBe(baseline.find(p => p.material.name === 'Undead skin')!.material);
   expect(city.find(p => p.material.name === 'City cloth')!.material.color.getHexString()).toBe(new Color(COLORS[owner]).getHexString());
  }
 });

 it('samples an animated shuffle and attack with compact crowd geometry and shared work poses', () => {
  const before = models.stats();
  for (const detail of ['full', 'crowd'] as const) {
   const a = models.get(zombie(), { ...idle, detail, moving: true })!;
   const b = models.get(zombie(), { ...idle, detail, moving: true, time: .4 })!;
   expect(a).toBeDefined(); expect(b).toBeDefined();
   expect(a[0].geometry).not.toBe(b[0].geometry);
   expect(Array.from(a[0].geometry.getAttribute('position').array)).not.toEqual(Array.from(b[0].geometry.getAttribute('position').array));
   const attack = models.get(zombie(), { ...idle, detail, attacking: true, time: .4 })!;
   const work = models.get(zombie(), { ...idle, detail, working: true, time: .4 })!;
   expect(attack.map(p => p.geometry)).toEqual(work.map(p => p.geometry));
  }
  const triangles = (detail: 'full' | 'crowd') => models.get(zombie(), { ...idle, detail })!.reduce((sum, p) => sum + p.geometry.index!.count / 3, 0);
  expect(triangles('crowd')).toBeLessThan(triangles('full') * .55);
  expect(models.stats()).toEqual(before);
 });

 it('releases shared undead materials and geometry exactly once and prevents stale access', () => {
  const parts = models.get(zombie(), idle)!;
  expect(parts).toBeDefined();
  let geometryDisposals = 0, materialDisposals = 0;
  parts[0].geometry.addEventListener('dispose', () => geometryDisposals++);
  parts[0].material.addEventListener('dispose', () => materialDisposals++);
  models.dispose(); models.dispose();
  expect(geometryDisposals).toBe(1); expect(materialDisposals).toBe(1);
  expect(models.stats().geometryBytes).toBe(0); expect(models.get(zombie(), idle)).toBeUndefined();
 });
});

it('keeps fallback zombies anatomical, reaching and independent of city colors and owners', () => {
 const models = new ModelLibrary();
 try {
  const parts = models.get('zombie', -2);
  expect(parts).toBe(models.get('zombie', 7));
  expect(parts.some(p => p.motion === 'legL' && p.geometry.type !== 'BoxGeometry')).toBe(true);
  expect(parts.some(p => p.motion === 'arm' && p.position[2] > .2)).toBe(true);
  const cityColors = new Set(COLORS.map(color => new Color(color).getHexString()));
  expect(parts.every(p => !cityColors.has(p.material.color.getHexString()))).toBe(true);
  expect(parts.filter(p => p.material instanceof MeshStandardMaterial && p.material.color.g > p.material.color.r * 1.1).length).toBeGreaterThan(2);
 } finally { models.dispose(); }
});
