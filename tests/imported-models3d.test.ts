import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Bone, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, RepeatWrapping, Skeleton, SkinnedMesh, SRGBColorSpace, Texture, Uint16BufferAttribute, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { ImportedModels, bakeStaticPose } from '../src/render/imported-models3d';
import type { Entity } from '../src/sim/types';

const entity = (type: string, id = 1, owner = 0) => ({ type, id, owner, kind: 'unit' }) as Entity;
const idle = { time: 0, moving: false, working: false, attacking: false };

/** Parse the actual shipped geometry without requiring a browser image decoder. */
async function geometryAsset(url: string): Promise<GLTF> {
 const bytes = await readFile(resolve('public', url.replace(/^\//, '')));
 const length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'));
 const offset = 20 + length + 8;
 json.buffers = [{ uri: `data:application/octet-stream;base64,${bytes.subarray(offset).toString('base64')}`, byteLength: bytes.length - offset }];
 for (const material of json.materials ?? []) {
  delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture;
  delete material.pbrMetallicRoughness?.baseColorTexture;
  delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
 }
 delete json.images; delete json.textures;
 globalThis.ProgressEvent ??= class extends Event { readonly lengthComputable = false; readonly loaded = 0; readonly total = 0; constructor(type: string) { super(type); } } as typeof ProgressEvent;
 return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

describe('imported shared pose models', () => {
 let models: ImportedModels;
 beforeAll(async () => { models = new ImportedModels(geometryAsset); await models.load(); }, 30000);

 it('loads real complete human and deer meshes with grounded finite sampled poses', () => {
  for (const type of ['villager', 'swordsman', 'archer', 'spearman', 'pikeman', 'crossbowman', 'deer', 'cow', 'alpaca', 'fox']) {
   for (const pose of [idle, { ...idle, moving: true, time: .25 }, { ...idle, working: true, time: .4 }, { ...idle, attacking: true, time: .6 }]) {
    const parts = models.get(entity(type), pose)!;
    expect(parts.length).toBeGreaterThan(1);
    let minimum = Infinity, maximum = -Infinity;
    for (const part of parts) {
     expect(part.geometry.userData.importedActor).toBe(true);
     const position = part.geometry.getAttribute('position'), normal = part.geometry.getAttribute('normal');
     expect(position.count).toBeGreaterThan(0); expect(normal.count).toBe(position.count);
     expect([...position.array, ...normal.array].every(Number.isFinite)).toBe(true);
     if (part.material.vertexColors) {
      const color = part.geometry.getAttribute('color');
      expect(color, `${type} requires its source vertex colors`).toBeDefined();
      expect(color.count).toBe(position.count);
     }
     part.geometry.computeBoundingBox();
     if (!part.geometry.userData.importedAttachment) minimum = Math.min(minimum, part.geometry.boundingBox!.min.y);
     maximum = Math.max(maximum, part.geometry.boundingBox!.max.y);
    }
    expect(minimum, `${type} ${JSON.stringify(pose)}`).toBeCloseTo(0, 4); expect(maximum).toBeGreaterThan(.3); expect(maximum).toBeLessThan(4.8);
   }
  }
 });

 it('selects genuinely animated, cached geometry without per-entity rigs or team skin tint', () => {
  const e = entity('villager'), a = models.get(e, { ...idle, moving: true, time: 0 })!, b = models.get(e, { ...idle, moving: true, time: .4 })!;
  expect(a).toBe(models.get(e, { ...idle, moving: true, time: 0 }));
  expect(a[0].geometry).not.toBe(b[0].geometry);
  expect(Array.from(a[0].geometry.getAttribute('position').array)).not.toEqual(Array.from(b[0].geometry.getAttribute('position').array));
  const opponent = models.get(entity('villager', 1, 1), { ...idle, moving: true })!;
  expect(opponent[0].geometry).toBe(a[0].geometry);
  expect(opponent[0].material).toBe(a[0].material);
  expect(opponent.some((part, i) => part.material !== a[i]?.material)).toBe(true);
  expect(models.get(entity('cavalry'), idle)).toBeUndefined();
  expect(models.get(entity('wood'), idle)).toBeUndefined();
 });

 it('keeps startup geometry bounded independently of the number of entities', () => {
  const before = models.stats();
  for (let id = 1; id <= 800; id++) models.get(entity(id % 2 ? 'villager' : 'swordsman', id, id % 8), { ...idle, moving: true, time: id / 10 });
  const after = models.stats();
  expect(after.bakedGeometries).toBe(before.bakedGeometries);
  expect(after.liveMixers).toBe(0);
  expect(after.poseFrames).toBeGreaterThanOrEqual(38);
 });

 it('provides bounded crowd poses with fewer triangles, original materials and intact attachments', () => {
  const before = models.stats();
  const triangles = (parts: ReturnType<ImportedModels['get']>) => parts!.reduce((sum, part) => sum + part.geometry.index!.count / 3, 0);
  for (const type of ['villager', 'swordsman', 'spearman', 'pikeman', 'archer', 'crossbowman']) {
   for (const pose of [idle, { ...idle, time: .4, moving: true }, { ...idle, time: .6, working: true }, { ...idle, time: .2, attacking: true }]) {
    const full = models.get(entity(type), pose)!, options = { ...pose, detail: 'crowd' as const }, crowd = models.get(entity(type), options)!;
    expect(crowd).toBe(models.get(entity(type), options));
    expect(triangles(crowd), type).toBeLessThan(triangles(full) * .55);
    expect(crowd.map(part => part.material)).toEqual(full.map(part => part.material));
    expect(crowd.filter(part => part.geometry.userData.importedAttachment).length).toBe(full.filter(part => part.geometry.userData.importedAttachment).length);
    for (const part of crowd) {
     const positions = part.geometry.getAttribute('position'), normals = part.geometry.getAttribute('normal');
     expect([...positions.array, ...normals.array].every(Number.isFinite)).toBe(true);
     if (part.material.vertexColors) expect(part.geometry.getAttribute('color').count).toBe(positions.count);
    }
   }
  }
  for (let id = 1; id <= 800; id++) models.get(entity('swordsman', id, id % 8), { ...idle, moving: true, detail: id % 2 ? 'crowd' : 'full' });
  expect(models.stats().bakedGeometries).toBe(before.bakedGeometries);
  expect(models.get(entity('deer'), { ...idle, detail: 'crowd' })).toBe(models.get(entity('deer'), idle));
 });

 it('owns and disposes each geometry and material once, with no stale access', () => {
  const parts = models.get(entity('villager'), idle)!;
  const geometryDisposed = vi.fn(), materialDisposed = vi.fn();
  parts[0].geometry.addEventListener('dispose', geometryDisposed);
  parts[0].material.addEventListener('dispose', materialDisposed);
  models.dispose(); models.dispose();
  expect(geometryDisposed).toHaveBeenCalledTimes(1); expect(materialDisposed).toHaveBeenCalledTimes(1);
  expect(models.get(entity('villager'), idle)).toBeUndefined();
 });
});

it('bakes skinning into independent world-space geometry and normals', () => {
 const geometry = new BufferGeometry();
 geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
 geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Array(12).fill(0), 4));
 geometry.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
 geometry.setIndex([0, 1, 2]); geometry.computeVertexNormals();
 const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial()), bone = new Bone(); mesh.add(bone); mesh.bind(new Skeleton([bone]));
 bone.position.x = 2; mesh.updateMatrixWorld(true); mesh.skeleton.update();
 const pose = bakeStaticPose(mesh);
 expect(new Vector3().fromBufferAttribute(pose[0].geometry.getAttribute('position'), 0).x).toBeCloseTo(2);
 expect(pose[0].geometry.getAttribute('skinWeight')).toBeUndefined();
 expect(pose[0].geometry.getAttribute('normal').getZ(0)).toBeCloseTo(1);
 pose[0].geometry.dispose(); geometry.dispose(); mesh.material.dispose(); mesh.skeleton.dispose();
});

it('reports failed assets and remains disposed if loading finishes late', async () => {
 const failed = new ImportedModels(async () => { throw new Error('offline'); });
 await expect(failed.load()).rejects.toThrow(/asset.*offline/i); expect(failed.status).toBe('failed'); failed.dispose();
 let finish!: (gltf: GLTF) => void;
 const deferred = new Promise<GLTF>(done => { finish = done; });
 const late = new ImportedModels(() => deferred);
 const loading = late.load(); late.dispose();
 const gltf = await geometryAsset('/models/character.glb'), disposed = vi.fn();
 gltf.scene.traverse(node => { if (node instanceof SkinnedMesh) node.geometry.addEventListener('dispose', disposed); });
 finish(gltf); await loading;
 expect(late.status).toBe('disposed'); expect(disposed).toHaveBeenCalled();
});

it('bundles every referenced texture, bark and twig alpha locally', async () => {
 for (const name of ['character', 'ranger', 'head', 'hair']) {
  const bytes = await readFile(resolve(`public/models/${name}.glb`)), length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'));
  for (const image of json.images ?? []) await access(resolve('public/models', image.uri));
 }
 for (const name of ['bark_diff.jpg', 'bark_nor_gl.jpg', 'twig_diff.jpg', 'twig_alpha.png', 'ground_diff.jpg']) await access(resolve('public/models/materials', name));
});

it('normalizes all bundled animal anatomy toward positive X', async () => {
 for (const name of ['deer', 'cow', 'alpaca', 'fox']) {
  const gltf = await geometryAsset(`/models/${name}.glb`);
  gltf.scene.rotation.y = Math.PI / 2; gltf.scene.updateMatrixWorld(true);
  const head = gltf.scene.getObjectByName('Head')!.getWorldPosition(new Vector3());
  const tail = gltf.scene.getObjectByName('Tail1')!.getWorldPosition(new Vector3());
  expect(head.x - tail.x, name).toBeGreaterThan(.1);
  expect(Math.abs(head.z - tail.z), name).toBeLessThan(Math.abs(head.x - tail.x) * .15);
  gltf.scene.traverse(node => { if (node instanceof SkinnedMesh) { node.geometry.dispose(); node.skeleton.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
 }
});

it('publishes texture lookups only after successful awaited loading and deduplicates requests', async () => {
 let finish!: (texture: Texture) => void;
 const textureLoader = vi.fn(() => new Promise<Texture>(done => { finish = done; }));
 const library = new ImportedModels(geometryAsset, textureLoader), texture = new Texture(), disposed = vi.fn();
 texture.addEventListener('dispose', disposed);
 const a = library.loadTextures(['bark']), b = library.loadTextures(['bark']);
 expect(library.texture('bark')).toBeUndefined(); expect(textureLoader).toHaveBeenCalledTimes(1);
 finish(texture); await Promise.all([a, b]);
 expect(library.texture('bark')).toBe(texture); expect(texture.colorSpace).toBe(SRGBColorSpace); expect(texture.wrapS).toBe(RepeatWrapping);
 await library.loadTextures(['bark']); expect(textureLoader).toHaveBeenCalledTimes(1);
 library.dispose(); library.dispose(); expect(disposed).toHaveBeenCalledTimes(1);
});

it('rejects failed optional maps with their path and safely releases late images', async () => {
 const failed = new ImportedModels(geometryAsset, async () => { throw new Error('image decode failed'); });
 await expect(failed.loadTextures(['twigAlpha'])).rejects.toThrow(/twigAlpha.*twig_alpha\.png.*image decode failed/i);
 expect(failed.texture('twigAlpha')).toBeUndefined(); failed.dispose();
 let finish!: (texture: Texture) => void;
 const library = new ImportedModels(geometryAsset, () => new Promise<Texture>(done => { finish = done; }));
 const loading = library.loadTextures(['bark']), texture = new Texture(), disposed = vi.fn(), close = vi.fn();
 texture.image = { width: 1, height: 1, close }; texture.addEventListener('dispose', disposed);
 library.dispose(); finish(texture); await loading;
 expect(library.texture('bark')).toBeUndefined(); expect(disposed).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
 expect(library.status).toBe('disposed');
});
