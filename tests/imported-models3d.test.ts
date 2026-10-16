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
  expect(models.get(entity('cavalry'), idle)).toBeDefined();
  expect(models.get(entity('wood'), idle)).toBeUndefined();
 });

 it('keeps startup geometry bounded independently of the number of entities', () => {
  const before = models.stats();
  for (let id = 1; id <= 800; id++) models.get(entity(['villager', 'swordsman', 'scout', 'cavalry', 'heavyCavalry'][id % 5], id, id % 8), { ...idle, moving: true, time: id / 10 });
  const after = models.stats();
  expect(after.bakedGeometries).toBe(before.bakedGeometries);
  expect(after.liveMixers).toBe(0);
  expect(after.materials).toBeLessThan(50);
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

 it('colors substantial clothing for every city while preserving skin, leather and metal', () => {
  for (const type of ['villager', 'swordsman', 'spearman', 'pikeman', 'archer', 'crossbowman', 'scout', 'cavalry', 'heavyCavalry']) {
   const baseline = models.get(entity(type), idle)!;
   expect(baseline, type).toBeDefined();
   const cloth = baseline.filter(p => p.material.name === 'City cloth');
   const skin = baseline.filter(p => p.material.name === 'Skin');
   expect(cloth.length, `${type} needs full clothing`).toBeGreaterThan(0);
   expect(skin.length, `${type} needs natural skin`).toBeGreaterThan(0);
   const area = (parts: typeof baseline) => parts.reduce((sum, p) => {
    const a = p.geometry.getAttribute('position'), indices = p.geometry.index!;
    const v = new Vector3(), w = new Vector3(), u = new Vector3();
    for (let i = 0; i < indices.count; i += 3) { v.fromBufferAttribute(a, indices.getX(i)); w.fromBufferAttribute(a, indices.getX(i + 1)).sub(v); u.fromBufferAttribute(a, indices.getX(i + 2)).sub(v); sum += w.cross(u).length() / 2; }
    return sum;
   }, 0);
   const humanoid = baseline.filter(p => !p.geometry.userData.importedMount && !p.geometry.userData.importedAttachment);
   expect(area(cloth), type).toBeGreaterThan(area(humanoid) * .25);
   const colors = new Set<string>();
   for (let owner = 0; owner < 8; owner++) {
    const parts = models.get(entity(type, 1, owner), idle)!;
    colors.add(parts.find(p => p.material.name === 'City cloth')!.material.color.getHexString());
    expect(parts.filter(p => p.material.name === 'Skin').map(p => p.material)).toEqual(skin.map(p => p.material));
    expect(parts.map(p => p.geometry)).toEqual(baseline.map(p => p.geometry));
   }
   expect(colors.size).toBe(8);
  }
 });

 it('uses different real human outfits and class equipment instead of one army costume', () => {
  const types = ['swordsman', 'pikeman', 'archer', 'crossbowman'];
  const bodies = types.map(type => models.get(entity(type), idle)!.find(p => p.material.name === 'City cloth')!.geometry);
  expect(new Set(bodies).size).toBe(4);
  const first = models.get(entity('villager', 1), idle)!, second = models.get(entity('villager', 2), idle)!;
  expect(first.find(p => p.material.name === 'City cloth')!.geometry).not.toBe(second.find(p => p.material.name === 'City cloth')!.geometry);
  const weaponLengths = ['spearman', 'pikeman'].map(type => Math.max(...models.get(entity(type), idle)!.filter(p => p.geometry.userData.importedAttachment).map(p => p.geometry.boundingBox!.max.y - p.geometry.boundingBox!.min.y)));
  expect(weaponLengths[1]).toBeGreaterThan(weaponLengths[0]);
  for (const type of ['archer', 'crossbowman']) {
   const attachments = models.get(entity(type), idle)!.filter(p => p.geometry.userData.importedAttachment);
   expect(Math.max(...attachments.map(p => p.geometry.boundingBox!.max.z)), `${type} readied weapon projects in front of torso`).toBeGreaterThan(.55);
  }

 });

 it('composes grounded animated horses and seated riders facing human positive Z in both detail banks', () => {
  for (const type of ['scout', 'cavalry', 'heavyCavalry']) for (const detail of ['full', 'crowd'] as const) {
   const a = models.get(entity(type), { ...idle, detail })!;
   expect(a, type).toBeDefined();
   const horse = a.filter(p => p.geometry.userData.importedMount), rider = a.filter(p => !p.geometry.userData.importedMount && !p.geometry.userData.importedAttachment);
   expect(horse.length).toBeGreaterThan(0); expect(rider.length).toBeGreaterThan(0);
   expect(Math.min(...horse.map(p => p.geometry.boundingBox!.min.y))).toBeCloseTo(0, 4);
   expect(Math.min(...rider.map(p => p.geometry.boundingBox!.min.y))).toBeGreaterThan(.45);
   expect(Math.max(...rider.map(p => p.geometry.boundingBox!.max.y))).toBeGreaterThan(Math.max(...horse.map(p => p.geometry.boundingBox!.max.y)));
   const allX = horse.map(p => p.geometry.boundingBox!.max.x - p.geometry.boundingBox!.min.x), allZ = horse.map(p => p.geometry.boundingBox!.max.z - p.geometry.boundingBox!.min.z);
   expect(Math.max(...allZ)).toBeGreaterThan(Math.max(...allX) * 2);
   const walkA = models.get(entity(type), { ...idle, moving: true, time: 0, detail })!, walkB = models.get(entity(type), { ...idle, moving: true, time: .4, detail })!;
   expect(walkA.find(p => p.geometry.userData.importedMount)!.geometry).not.toBe(walkB.find(p => p.geometry.userData.importedMount)!.geometry);
   expect(walkA.find(p => p.material.name === 'City cloth')!.geometry).not.toBe(walkB.find(p => p.material.name === 'City cloth')!.geometry);
   for (let sample = 0; sample < 12; sample++) {
    const pose = models.get(entity(type, 0), { ...idle, moving: true, time: sample * .09, detail })!;
    const rider = pose.filter(p => !p.geometry.userData.importedMount && !p.geometry.userData.importedAttachment);
    const horse = pose.filter(p => p.geometry.userData.importedMount);
    expect(Math.min(...rider.map(p => p.geometry.boundingBox!.min.y)), `${type} rider feet remain raised at sample ${sample}`).toBeGreaterThan(.45);
    expect(Math.max(...rider.map(p => p.geometry.boundingBox!.max.y)), `${type} rider remains seated at sample ${sample}`).toBeGreaterThan(Math.max(...horse.map(p => p.geometry.boundingBox!.max.y)));
   }

  }
 });

 it('gives workers and ranged classes distinct work and combat silhouettes in both shared detail banks', () => {
  for(const type of ['villager','archer','crossbowman'])for(const detail of ['full','crowd'] as const) {
   const actor=entity(type,0), work=models.get(actor,{...idle,working:true,time:0,detail})!,attack=models.get(actor,{...idle,attacking:true,time:0,detail})!;
   const positions=(parts:typeof work)=>parts.filter(p=>!p.geometry.userData.importedAttachment).flatMap(p=>Array.from(p.geometry.getAttribute('position').array));
   expect(positions(attack),`${type} ${detail} combat differs from work`).not.toEqual(positions(work));
  }
 });

 it('lowers mounted lances into a forward strike while keeping the original horse geometry unchanged', () => {
  for(const detail of ['full','crowd'] as const) {
   const actor=entity('heavyCavalry',0), resting=models.get(actor,{...idle,detail})!,strike=models.get(actor,{...idle,attacking:true,time:0,detail})!;
   const projection=(parts:typeof resting)=>Math.max(...parts.filter(p=>p.geometry.userData.importedAttachment).map(p=>p.geometry.boundingBox!.max.z));
   expect(projection(strike)).toBeGreaterThan(projection(resting)+.35);
   expect(strike.filter(p=>p.geometry.userData.importedMount).map(p=>Array.from(p.geometry.getAttribute('position').array))).toEqual(resting.filter(p=>p.geometry.userData.importedMount).map(p=>Array.from(p.geometry.getAttribute('position').array)));
  }
 });

 it('owns and disposes each geometry and material once, with no stale access', () => {
  const parts = models.get(entity('villager'), idle)!;
  const mounted = models.get(entity('heavyCavalry'), { ...idle, moving: true })!;
  const mountDisposed = vi.fn(), clothDisposed = vi.fn();
  mounted.find(p => p.geometry.userData.importedMount)!.geometry.addEventListener('dispose', mountDisposed);
  mounted.find(p => p.material.name === 'City cloth')!.material.addEventListener('dispose', clothDisposed);
  const geometryDisposed = vi.fn(), materialDisposed = vi.fn();
  parts[0].geometry.addEventListener('dispose', geometryDisposed);
  parts[0].material.addEventListener('dispose', materialDisposed);
  models.dispose(); models.dispose();
  expect(geometryDisposed).toHaveBeenCalledTimes(1); expect(materialDisposed).toHaveBeenCalledTimes(1);
  expect(models.get(entity('villager'), idle)).toBeUndefined();
  expect(mountDisposed).toHaveBeenCalledTimes(1); expect(clothDisposed).toHaveBeenCalledTimes(1);
  expect(models.stats().geometryBytes).toBe(0);
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


it('uses cool iron vertex colors on the heavy cavalry helmet rather than wood colors', async () => {
 const asset = await geometryAsset('/models/ashen/helm.glb');
 let red = 0, blue = 0, vertices = 0;
 asset.scene.traverse(node => {
  if (!(node instanceof SkinnedMesh) && !('isMesh' in node)) return;
  const mesh = node as SkinnedMesh;
  if (Array.isArray(mesh.material) || mesh.material.name !== 'Metal') return;
  const colors = mesh.geometry.getAttribute('color');
  for (let i = 0; i < colors.count; i++) { red += colors.getX(i); blue += colors.getZ(i); vertices++; }
 });
 expect(vertices).toBeGreaterThan(100); expect(blue).toBeGreaterThan(red * 1.1);
});

it('yields during pose preparation and can leave the screen without retaining partial banks', async () => {
 const library=new ImportedModels(geometryAsset);let yielded=false;
 const timer=setInterval(()=>{if(library.status==='loading'&&library.stats().poseFrames>0){yielded=true;library.dispose();}},0);
 try{await library.load();expect(yielded).toBe(true);expect(library.status).toBe('disposed');expect(library.stats().bakedGeometries).toBe(0);}finally{clearInterval(timer);library.dispose();}
});
