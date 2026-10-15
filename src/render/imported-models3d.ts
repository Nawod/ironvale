import {
 AnimationMixer, BoxGeometry, BufferGeometry, CylinderGeometry,
 Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Object3D,
 Quaternion, RepeatWrapping, Skeleton, SkinnedMesh, SRGBColorSpace, Texture,
 TextureLoader, TorusGeometry, Vector3,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS } from '../sim/definitions';
import type { Entity } from '../sim/types';
import type { ModelPart } from './models3d';

export const MODEL_TEXTURE_URLS = {
 bark: './models/materials/bark_diff.jpg', barkNormal: './models/materials/bark_nor_gl.jpg',
 barkArm: './models/materials/bark_arm.jpg', twig: './models/materials/twig_diff.jpg',
 twigNormal: './models/materials/twig_nor_gl.jpg', twigAlpha: './models/materials/twig_alpha.png',
 ground: './models/materials/ground_diff.jpg', groundNormal: './models/materials/ground_normal.jpg',
 groundArm: './models/materials/ground_arm.jpg',
} as const;
export type ModelTexture = keyof typeof MODEL_TEXTURE_URLS;
export interface ImportedPoseOptions { time: number; moving: boolean; working: boolean; attacking: boolean; detail?: 'full' | 'crowd' }
type PoseKind = 'idle' | 'walk' | 'work' | 'attack';
type AssetLoader = (url: string) => Promise<GLTF>;
type TextureAssetLoader = (url: string) => Promise<Texture>;
interface PoseFrame { parts: ModelPart[]; right: Matrix4; left: Matrix4 }
interface PoseCycle { duration: number; frames: PoseFrame[] }
const MOUNTED_TYPES = ['scout', 'cavalry', 'heavyCavalry'];
const ARMY_OUTFITS: Record<string, string[]> = { apothecary: ['villager.v0'], falconer: ['villager.v1'], alchemist: ['villager.v2'], guard: ['swordsman', 'spearman'], marshal: ['pikeman'], ranger: ['archer'], executioner: ['crossbowman'] };
const ARMY_EQUIPMENT = ['sword', 'shield', 'kite', 'pike', 'helm'];
const ANIMAL_TYPES = ['deer', 'cow', 'alpaca', 'fox', 'horse'];
const ASSETS = [...Object.keys(ARMY_OUTFITS).map(name => `ashen/${name}`), ...ARMY_EQUIPMENT.map(name => `ashen/${name}`), ...ANIMAL_TYPES];
const SAMPLES = 6;
const zero: [number, number, number] = [0, 0, 0];
const one: [number, number, number] = [1, 1, 1];
const part = (geometry: BufferGeometry, material: MeshStandardMaterial): ModelPart => ({ geometry, material, position: [...zero], scale: [...one], rotation: [...zero] });

/** CPU-skin a single sampled pose, discard skin attributes and merge by material.
 * The returned geometry is independent of the rig. Materials remain caller-owned.
 */
export function bakeStaticPose(root: Object3D, humanDetail: boolean | 'crowd' = false): ModelPart[] {
 root.updateMatrixWorld(true);
 root.traverse(node => { if (node instanceof SkinnedMesh) node.skeleton.update(); });
 const groups = new Map<MeshStandardMaterial, BufferGeometry[]>(), position = new Vector3();
 root.traverse(node => {
  if (!(node instanceof Mesh) || !node.visible) return;
  const source = node.geometry, sourcePositions = source.getAttribute('position'), uv = source.getAttribute('uv'), color = source.getAttribute('color');
  if (!sourcePositions) return;
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  const ranges = source.groups.length ? source.groups : [{ start: 0, count: source.index?.count ?? sourcePositions.count, materialIndex: 0 }];
  for (const range of ranges) {
   const material = materials[range.materialIndex ?? 0];
   if (!(material instanceof MeshStandardMaterial) || !range.count) continue;
   const remap = new Map<number, number>(), positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
   // Cluster dense boot/clothing tessellation in bind space, preserving UV islands.
   // The fixed bind-space topology is identical across every sampled pose.
   const crowd = humanDetail === 'crowd', uvCell = crowd ? .25 : .12;
   const cell = humanDetail && sourcePositions.count > 300 ? Number(crowd ? node.userData.importedCrowdCell ?? .1 : node.userData.importedDetailCell ?? .04) : 0;
   const clusters = new Map<string, number>(), counts: number[] = [];
   const end = Math.min(range.start + range.count, source.index?.count ?? sourcePositions.count);
   for (let i = range.start; i < end; i++) {
    const original = source.index ? source.index.getX(i) : i;
    let mapped = remap.get(original);
    if (mapped === undefined) {
     const cluster = cell ? `${Math.round(sourcePositions.getX(original) / cell)},${Math.round(sourcePositions.getY(original) / cell)},${Math.round(sourcePositions.getZ(original) / cell)}:${Math.round((uv?.getX(original) ?? 0) / uvCell)},${Math.round((uv?.getY(original) ?? 0) / uvCell)}` : String(original);
     mapped = clusters.get(cluster);
     node.getVertexPosition(original, position).applyMatrix4(node.matrixWorld);
     if (![position.x, position.y, position.z].every(Number.isFinite)) throw new Error(`Invalid imported pose position in ${node.name}`);
     if (mapped === undefined) {
      mapped = counts.length; clusters.set(cluster, mapped); counts.push(1);
      positions.push(position.x, position.y, position.z); uvs.push(uv?.getX(original) ?? 0, uv?.getY(original) ?? 0);
      colors.push(color?.getX(original) ?? 1, color?.getY(original) ?? 1, color?.getZ(original) ?? 1, color && color.itemSize > 3 ? color.getW(original) : 1);
     } else {
      counts[mapped]++;
      positions[mapped * 3] += position.x; positions[mapped * 3 + 1] += position.y; positions[mapped * 3 + 2] += position.z;
      uvs[mapped * 2] += uv?.getX(original) ?? 0; uvs[mapped * 2 + 1] += uv?.getY(original) ?? 0;
      colors[mapped * 4] += color?.getX(original) ?? 1; colors[mapped * 4 + 1] += color?.getY(original) ?? 1; colors[mapped * 4 + 2] += color?.getZ(original) ?? 1; colors[mapped * 4 + 3] += color && color.itemSize > 3 ? color.getW(original) : 1;
     }
     remap.set(original, mapped);
    }
    indices.push(mapped);
   }
   for (let i = 0; i < counts.length; i++) {
    for (let axis = 0; axis < 3; axis++) positions[i * 3 + axis] /= counts[i];
    for (let axis = 0; axis < 2; axis++) uvs[i * 2 + axis] /= counts[i];
    for (let axis = 0; axis < 4; axis++) colors[i * 4 + axis] /= counts[i];
   }
   const triangles: number[] = [], seen = new Set<string>();
   for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    if (a === b || a === c || b === c) continue;
    const key = [a, b, c].sort((x, y) => x - y).join(',');
    if (!seen.has(key)) { triangles.push(a, b, c); seen.add(key); }
   }
   if (!triangles.length) continue;
   const geometry = new BufferGeometry();
   geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
   geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
   geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));
   geometry.setIndex(triangles); geometry.computeVertexNormals();
   const list = groups.get(material) ?? []; list.push(geometry); groups.set(material, list);
  }
 });
 const result: ModelPart[] = [];
 for (const [material, geometries] of groups) {
  const geometry = mergeGeometries(geometries, false);
  for (const source of geometries) source.dispose();
  if (!geometry) throw new Error('Imported pose geometry cannot be merged');
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  result.push(part(geometry, material));
 }
 return result;
}

/** Finite shared pose banks; no skeleton, mixer or geometry is created per entity. */
export class ImportedModels {
 status: 'idle' | 'loading' | 'ready' | 'failed' | 'disposed' = 'idle';
 error?: string;
 private pending?: Promise<void>;
 private cycles = new Map<string, PoseCycle>();
 private cached = new Map<string, ModelPart[]>();
 private geometries = new Set<BufferGeometry>();
 private materials = new Set<MeshStandardMaterial>();
 private textures = new Set<Texture>();
 private textureCache = new Map<ModelTexture, Texture>();
 private texturePending = new Map<ModelTexture, Promise<void>>();
 private closedImages = new WeakSet<object>();
 private skeletons = new Set<Skeleton>();
 private teams: MeshStandardMaterial[] = [];
 private accent = new MeshStandardMaterial({ name: 'City cloth', color: '#ffffff', vertexColors: true, roughness: .92 });
 private paletteSkin = new MeshStandardMaterial({ name: 'Skin', vertexColors: true, roughness: .87 });
 private paletteTrim = new MeshStandardMaterial({ name: 'Leather and trim', vertexColors: true, roughness: .94 });
 private paletteMetal = new MeshStandardMaterial({ name: 'Metal', vertexColors: true, roughness: .48, metalness: .65 });
 private steel = new MeshStandardMaterial({ color: '#a4afb1', roughness: .49, metalness: .7 });
 private wood = new MeshStandardMaterial({ color: '#72513a', roughness: .94 });
 private poseCount = 0;

 constructor(private loader: AssetLoader = url => new GLTFLoader().loadAsync(url), private textureLoader: TextureAssetLoader = url => new TextureLoader().loadAsync(url)) {
  for (const material of [this.accent, this.steel, this.wood, this.paletteSkin, this.paletteTrim, this.paletteMetal]) this.materials.add(material);
  this.teams = COLORS.map(color => { const material = new MeshStandardMaterial({ name: 'City cloth', color, vertexColors: true, roughness: .9 }); this.materials.add(material); return material; });
 }

 load(): Promise<void> {
  if (this.pending) return this.pending;
  if (this.status === 'disposed') return Promise.resolve();
  this.status = 'loading';
  this.pending = this.loadAll();
  return this.pending;
 }

 private async loadAll(): Promise<void> {
  const results = await Promise.allSettled(ASSETS.map(name => this.loader(`./models/${name}.glb`)));
  const assets = new Map<string, GLTF>();
  results.forEach((result, i) => { if (result.status === 'fulfilled') { assets.set(ASSETS[i], result.value); this.trackSource(result.value.scene); } });
  if (this.status === 'disposed') { this.release(); return; }
  try {
   const failure = results.findIndex(result => result.status === 'rejected');
   if (failure >= 0) throw new Error(`${ASSETS[failure]}.glb: ${(results[failure] as PromiseRejectedResult).reason}`);
   for (const [name, asset] of assets) if (name.startsWith('ashen/')) asset.scene.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const palette = (material: MeshStandardMaterial) => {
     const shared = { 'City cloth': this.accent, Skin: this.paletteSkin, 'Leather and trim': this.paletteTrim, Metal: this.paletteMetal }[material.name] ?? material;
     if (shared !== material && this.materials.delete(material)) material.dispose();
     return shared;
    };
    node.material = Array.isArray(node.material) ? node.material.map(material => palette(material as MeshStandardMaterial)) : palette(node.material as MeshStandardMaterial);
   });
   // Let input, rendering and screen disposal run between shared pose banks.
   const pause=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
   for (const outfit of Object.keys(ARMY_OUTFITS)) for (const detail of ['full', 'crowd'] as const) {
    this.bakeArmy(outfit, assets, detail);await pause();if((this.status as string)==='disposed')return;
   }
   for (const detail of ['full', 'crowd'] as const) {
    this.bakeMounted(assets, detail);await pause();if((this.status as string)==='disposed')return;
   }
   for (const animal of ANIMAL_TYPES) {
    this.bakeAnimal(animal, assets.get(animal)!);await pause();if((this.status as string)==='disposed')return;
   }
   this.status = 'ready';
  } catch (error) {
   this.error = `Imported asset loading failed: ${error instanceof Error ? error.message : String(error)}`;
   this.status = 'failed'; this.release(); throw new Error(this.error);
  } finally {
   // Source rigs are no longer needed after baking. Baked parts retain their materials/textures.
   const sourceGeometry = new Set<BufferGeometry>(), sourceSkeletons = new Set<Skeleton>();
   for (const gltf of assets.values()) gltf.scene.traverse(node => { if (node instanceof Mesh) sourceGeometry.add(node.geometry); if (node instanceof SkinnedMesh) sourceSkeletons.add(node.skeleton); });
   for (const geometry of sourceGeometry) if (this.geometries.delete(geometry)) geometry.dispose();
   for (const skeleton of sourceSkeletons) if (this.skeletons.delete(skeleton)) skeleton.dispose();
  }
 }

 private trackSource(root: Object3D): void {
  root.traverse(node => {
   if (!(node instanceof Mesh)) return;
   this.geometries.add(node.geometry);
   if (node instanceof SkinnedMesh) this.skeletons.add(node.skeleton);
   for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
    if (!(material instanceof MeshStandardMaterial)) continue;
    this.materials.add(material);
    for (const value of Object.values(material)) if (value instanceof Texture) this.textures.add(value);
   }
  });
 }

 private remember(parts: ModelPart[]): ModelPart[] {
  for (const p of parts) { p.geometry.userData.importedActor = true; this.geometries.add(p.geometry); }
  return parts;
 }

 /** The free Ashen sampler has its own complete, compatible per-outfit rigs. */
 private bakeArmy(outfit: string, assets: Map<string, GLTF>, detail: 'full' | 'crowd'): void {
  const source = assets.get(`ashen/${outfit}`)!, model = clone(source.scene), root = new Group();
  root.scale.setScalar(.9); root.add(model);
  model.traverse(node => { if (node instanceof Mesh) { node.userData.importedDetailCell = .025; node.userData.importedCrowdCell = .14; } });
  const mixer = new AnimationMixer(model);
  try {
   for (const [kind, animation] of Object.entries({ idle: 'idle', walk: 'move_slow', work: 'attack_01', attack: 'attack_01' }) as [PoseKind, string][]) {
    const clip = source.animations.find(clip => clip.name === animation);
    if (!clip) throw new Error(`Missing ${outfit} animation ${animation}`);
    mixer.stopAllAction(); const action = mixer.clipAction(clip).reset().play();
    const cycle: PoseCycle = { duration: clip.duration, frames: [] };
    for (let i = 0; i < (kind === 'idle' ? 1 : SAMPLES); i++) {
     action.time = clip.duration * i / SAMPLES; mixer.update(0);
     if (outfit === 'ranger' || outfit === 'executioner') {
      // Ranged troops carry their weapon ready in front of the chest, while the
      // source lower-body animation continues to walk and the torso still turns.
      for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
       this.pointBone(model, `upper_arm${side}`, new Vector3(sign * .12, -.8, .35));
       this.pointBone(model, `forearm${side}`, new Vector3(-sign * .2, .12, .9));
      }
     }
     root.updateMatrixWorld(true);
     const parts = this.remember(bakeStaticPose(root, detail === 'crowd' ? 'crowd' : true)), floor = this.ground(parts);
     const right = model.getObjectByName('handR')!.getWorldPosition(new Vector3()), left = model.getObjectByName('handL')!.getWorldPosition(new Vector3());
     right.y -= floor; left.y -= floor;
     cycle.frames.push({ parts, right: new Matrix4().setPosition(right), left: new Matrix4().setPosition(left) }); this.poseCount++;
    }
    for (const type of ARMY_OUTFITS[outfit]) this.cycles.set(`${type}:${kind}${detail === 'crowd' ? ':crowd' : ''}`, {
     duration: cycle.duration, frames: cycle.frames.map(frame => ({ ...frame, parts: [...frame.parts, ...this.equipment(type.split('.')[0], frame, assets, detail)] })),
    });
   }
  } finally { this.releaseRig(model, mixer); }
 }

 /** Riders are baked on the existing horse in its native +Z orientation. Wildlife
  * retains the separate +X convention in bakeAnimal, including the original maps. */
 private bakeMounted(assets: Map<string, GLTF>, detail: 'full' | 'crowd'): void {
  const horseSource = assets.get('horse')!, horse = clone(horseSource.scene), horseRoot = new Group();
  horseRoot.scale.setScalar(.4); horseRoot.add(horse);
  const horseMixer = new AnimationMixer(horse);
  try {
   for (const [kind, animation] of [['idle', 'Idle'], ['walk', 'Gallop'], ['attack', 'Idle']] as const) {
    const clip = horseSource.animations.find(clip => clip.name === animation)!;
    horseMixer.stopAllAction(); const action = horseMixer.clipAction(clip).reset().play();
    const horseFrames: { parts: ModelPart[]; seat: Vector3 }[] = [];
    for (let i = 0; i < (kind === 'idle' ? 1 : SAMPLES); i++) {
     action.time = clip.duration * i / SAMPLES; horseMixer.update(0); horseRoot.updateMatrixWorld(true);
     const parts = this.remember(bakeStaticPose(horseRoot)); const floor = this.ground(parts);
     for (const part of parts) part.geometry.userData.importedMount = true;
     const seat = horse.getObjectByName('Torso2')!.getWorldPosition(new Vector3()); seat.y += .19 - floor; seat.z -= .1;
     horseFrames.push({ parts, seat }); this.poseCount++;
    }
    for (const type of MOUNTED_TYPES) {
     const outfit = type === 'scout' ? 'ranger' : type === 'heavyCavalry' ? 'marshal' : 'guard';
     const model = clone(assets.get(`ashen/${outfit}`)!.scene), root = new Group(); root.scale.setScalar(.9); root.add(model);
     model.traverse(node => { if (node instanceof Mesh) { node.userData.importedDetailCell = .025; node.userData.importedCrowdCell = .14; } });
     const mixer = new AnimationMixer(model), idle = assets.get(`ashen/${outfit}`)!.animations.find(clip => clip.name === 'idle')!;
     const action = mixer.clipAction(idle).play(), frames: PoseFrame[] = [];
     try {
      for (let i = 0; i < horseFrames.length; i++) {
       action.time = idle.duration * i / SAMPLES; mixer.update(0); root.position.set(0, 0, 0);
       // Replace walking lower-body motion with a true straddling seat. Bone local
       // Y points down the leg. Construct each thigh/shin direction explicitly.
       for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
        this.pointBone(model, `thigh${side}`, new Vector3(sign * .52, -.48, .52));
        this.pointBone(model, `shin${side}`, new Vector3(sign * .05, -.92, -.25));
        this.pointBone(model, `foot${side}`, new Vector3(0, -.2, 1));
        this.pointBone(model, `upper_arm${side}`, new Vector3(sign * .12, -.8, .3));
        this.pointBone(model, `forearm${side}`, new Vector3(-sign * .12, -.12, .8));
       }
       root.updateMatrixWorld(true);
       const pelvis = model.getObjectByName('pelvis')!.getWorldPosition(new Vector3());
       root.position.copy(horseFrames[i].seat).sub(pelvis); root.updateMatrixWorld(true);
       const parts = this.remember(bakeStaticPose(root, detail === 'crowd' ? 'crowd' : true));
       const right = new Matrix4().setPosition(model.getObjectByName('handR')!.getWorldPosition(new Vector3())), left = new Matrix4().setPosition(model.getObjectByName('handL')!.getWorldPosition(new Vector3()));
       const frame: PoseFrame = { parts, right, left };
       frames.push({ ...frame, parts: [...horseFrames[i].parts, ...parts, ...this.equipment(type, frame, assets, detail), ...this.saddle(horseFrames[i].seat, type, frame)] }); this.poseCount++;
      }
      const cycle = { duration: clip.duration, frames };
      this.cycles.set(`${type}:${kind}${detail === 'crowd' ? ':crowd' : ''}`, cycle);
      if (kind === 'idle') this.cycles.set(`${type}:work${detail === 'crowd' ? ':crowd' : ''}`, cycle);
     } finally { this.releaseRig(model, mixer); }
    }
   }
  } finally { this.releaseRig(horse, horseMixer); }
 }

 private pointBone(model: Object3D, name: string, target: Vector3): void {
  const bone = model.getObjectByName(name)!; bone.parent!.updateWorldMatrix(true, false);
  const parent = bone.parent!.getWorldQuaternion(new Quaternion());
  bone.quaternion.copy(parent.invert().multiply(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), target.normalize())));
 }

 private releaseRig(model: Object3D, mixer: AnimationMixer): void {
  mixer.stopAllAction(); mixer.uncacheRoot(model);
  const skeletons = new Set<Skeleton>(); model.traverse(node => { if (node instanceof SkinnedMesh) skeletons.add(node.skeleton); });
  for (const skeleton of skeletons) skeleton.dispose();
 }

 private saddle(seat: Vector3, type: string, frame: PoseFrame): ModelPart[] {
  const root = new Group(), temporaries: BufferGeometry[] = [];
  const add = (geometry: BufferGeometry, material: MeshStandardMaterial, x: number, y: number, z: number) => {
   temporaries.push(geometry); const mesh = new Mesh(geometry, material); mesh.position.set(seat.x + x, seat.y + y, seat.z + z); root.add(mesh);
  };
  // Reins connect both hands to the bridle; no loose poles beside the rider.
  for (const [matrix, side] of [[frame.left, 1], [frame.right, -1]] as const) {
   const hand = new Vector3().setFromMatrixPosition(matrix), bridle = new Vector3(side * .105, seat.y + .12, seat.z + 1.12);
   const direction = bridle.clone().sub(hand), geometry = new CylinderGeometry(.012, .012, direction.length(), 5);
   temporaries.push(geometry); const rein = new Mesh(geometry, this.wood);
   rein.position.copy(hand).add(bridle).multiplyScalar(.5); rein.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()); root.add(rein);
  }
  // Broad city-colored saddle cloth, leather seat, and visible stirrups.
  add(new BoxGeometry(.65, .12, .68), this.accent, 0, -.12, 0);
  for (const sign of [-1, 1]) {
   add(new BoxGeometry(.045, .43, .63), this.accent, sign * .29, -.31, 0);
   add(new BoxGeometry(.025, .42, .045), this.wood, sign * .34, -.4, .06);
   add(new TorusGeometry(.075, .014, 4, 8), this.steel, sign * .34, -.63, .06);
  }
  add(new BoxGeometry(.39, .08, .5), this.wood, 0, -.03, 0);
  if (type === 'heavyCavalry') for (const sign of [-1, 1]) add(new BoxGeometry(.035, .32, .5), this.steel, sign * .285, -.2, .43);
  const parts = this.remember(bakeStaticPose(root));
  for (const part of parts) part.geometry.userData.importedAttachment = true;
  for (const geometry of temporaries) geometry.dispose();
  return parts;
 }

 private bakeAnimal(type: string, source: GLTF): void {
  const model = clone(source.scene), root = new Group();
  // Native Quaternius forward +Z -> animal +X, matching heading - PI/2 in Battlefield.
  root.rotation.y = Math.PI / 2; root.scale.setScalar(type === 'fox' ? .25 : type === 'alpaca' ? .34 : .4); root.add(model);
  const mixer = new AnimationMixer(model);
  try {
   for (const [kind, preferred] of [['idle', 'Idle'], ['walk', 'Walk']] as const) {
    const clip = source.animations.find(animation => animation.name === preferred);
    if (!clip) throw new Error(`Missing ${type} animation ${preferred}`);
    mixer.stopAllAction(); const action = mixer.clipAction(clip).reset().play();
    const frames: PoseFrame[] = [];
    for (let i = 0; i < (kind === 'idle' ? 1 : SAMPLES); i++) {
     action.time = clip.duration * i / SAMPLES; mixer.update(0);
     const parts = this.remember(bakeStaticPose(root)); this.ground(parts);
     frames.push({ parts, right: new Matrix4(), left: new Matrix4() }); this.poseCount++;
    }
    this.cycles.set(`${type}:${kind}`, { duration: clip.duration, frames });
   }
  } finally {
   mixer.stopAllAction(); mixer.uncacheRoot(model);
   const skeletons = new Set<Skeleton>(); model.traverse(node => { if (node instanceof SkinnedMesh) skeletons.add(node.skeleton); });
   for (const skeleton of skeletons) skeleton.dispose();
  }
 }

 private ground(parts: ModelPart[]): number {
  const floor = Math.min(...parts.map(p => p.geometry.boundingBox!.min.y));
  for (const p of parts) { p.geometry.translate(0, -floor, 0); p.geometry.computeBoundingBox(); p.geometry.computeBoundingSphere(); }
  return floor;
 }

 private equipment(type: string, frame: PoseFrame, assets: Map<string, GLTF>, detail: 'full' | 'crowd'): ModelPart[] {
  const root = new Group(), temps: BufferGeometry[] = [];
  const add = (geometry: BufferGeometry, material: MeshStandardMaterial, x: number, y: number, z = 0, matrix = frame.right) => {
   temps.push(geometry); const mesh = new Mesh(geometry, material); mesh.position.set(x, y, z); mesh.updateMatrix(); mesh.matrix.premultiply(matrix); mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale); root.add(mesh); return mesh;
  };
  const imported = (name: string, matrix: Matrix4, scale = 1, y = 0, rotation = 0) => {
   const model = assets.get(`ashen/${name}`)!.scene.clone(true);
   model.scale.setScalar(scale); model.rotation.y = rotation; model.position.y = y;
   model.updateMatrix(); model.matrix.premultiply(matrix); model.matrix.decompose(model.position, model.quaternion, model.scale);
   model.traverse(node => { if (node instanceof Mesh) { node.userData.importedDetailCell = .018; node.userData.importedCrowdCell = .035; } }); root.add(model);
  };
  if (type === 'pikeman') {
   imported('pike', frame.right, .9, Math.max(.36, 1.23 - frame.right.elements[13]));
   imported('kite', frame.left, .65, -.03, Math.PI / 2);
  } else if (type === 'spearman' || type === 'heavyCavalry') {
   const length = type === 'heavyCavalry' ? 2.6 : 1.95;
   add(new CylinderGeometry(.019, .024, length, 6), this.wood, 0, .28);
   add(new CylinderGeometry(0, .07, .25, 6), this.steel, 0, .28 + length / 2 + .1);
  } else if (type === 'archer') {
   const bow = add(new TorusGeometry(.46, .022, 4, 14, Math.PI), this.wood, 0, 0, .03, frame.left); bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
   add(new CylinderGeometry(.006, .006, .92, 4), this.wood, 0, 0, .03, frame.left);
   const arrow = add(new CylinderGeometry(.009, .009, .68, 4), this.wood, 0, 0, .34, frame.left); arrow.rotateX(Math.PI / 2);
  } else if (type === 'crossbowman') {
   add(new BoxGeometry(.085, .12, .53), this.wood, 0, 0, .12);
   add(new BoxGeometry(.58, .045, .05), this.steel, 0, 0, .28);
  } else if (type === 'villager') {
   add(new CylinderGeometry(.024, .027, .65, 6), this.wood, 0, .18);
   add(new BoxGeometry(.32, .14, .055), this.steel, .07, .46);
  } else if (type === 'scout') {
   add(new CylinderGeometry(.025, .03, .55, 6), this.wood, 0, .15);
   add(new BoxGeometry(.18, .1, .06), this.steel, .03, .41);
  } else {
   imported('sword', frame.right, .85, .1);
   imported('shield', frame.left, .7, -.03, Math.PI / 2);
  }
  if (type === 'heavyCavalry') {
   imported('kite', frame.left, .75, -.03, Math.PI / 2);
   // Helmet follows the rider head instead of being placed on the horse.
   const head = frame.parts.filter(p => p.material.name === 'Skin').flatMap(p => [p.geometry.boundingBox!.max.y]);
   imported('helm', new Matrix4().makeTranslation(0, Math.max(...head) - .12, frame.right.elements[14] - .3), .8);
  }
  const baked = this.remember(bakeStaticPose(root, detail === 'crowd' ? 'crowd' : true));
  for (const p of baked) p.geometry.userData.importedAttachment = true;
  for (const geometry of temps) geometry.dispose();
  return baked;
 }

 get(entity: Entity, options: ImportedPoseOptions): ModelPart[] | undefined {
  if (this.status !== 'ready') return;
  const rawType = String(entity.type), type = rawType === 'villager' ? `villager.v${((entity.id % 3) + 3) % 3}` : rawType, animal = ANIMAL_TYPES.includes(type);
  const kind: PoseKind = animal ? options.moving ? 'walk' : 'idle' : options.attacking ? 'attack' : options.working ? 'work' : options.moving ? 'walk' : 'idle';
  const detail = options.detail === 'crowd' && !animal ? 'crowd' : 'full';
  const cycle = this.cycles.get(`${type}:${kind}${detail === 'crowd' ? ':crowd' : ''}`); if (!cycle) return;
  const seconds = Number.isFinite(options.time) ? options.time : 0;
  const phase = ((seconds + (entity.id % 17) * .073) % cycle.duration + cycle.duration) % cycle.duration;
  const index = Math.min(cycle.frames.length - 1, Math.floor(phase / cycle.duration * cycle.frames.length));
  const frame = cycle.frames[index]; if (animal) return frame.parts;
  const owner = Math.max(0, entity.owner) % this.teams.length, key = `${type}:${kind}:${index}:${owner}:${detail}`;
  let result = this.cached.get(key);
  if (!result) { result = frame.parts.map(p => p.material === this.accent ? { ...p, material: this.teams[owner] } : p); this.cached.set(key, result); }
  return result;
 }

 textureUrl(name: ModelTexture): string { return MODEL_TEXTURE_URLS[name]; }

 /** A lookup never starts image requests or publishes an unfinished placeholder. */
 texture(name: ModelTexture): Texture | undefined { return this.status === 'disposed' ? undefined : this.textureCache.get(name); }

 /** Await decoded optional maps before installing forest/terrain materials. */
 async loadTextures(names: ModelTexture[]): Promise<void> {
  if (this.status === 'disposed') return;
  await Promise.all([...new Set(names)].map(name => this.loadTexture(name)));
 }

 private loadTexture(name: ModelTexture): Promise<void> {
  if (this.textureCache.has(name)) return Promise.resolve();
  const existing = this.texturePending.get(name); if (existing) return existing;
  const pending = this.textureLoader(this.textureUrl(name)).then(texture => {
   if (this.status === 'disposed') { this.releaseTexture(texture); return; }
   if (name === 'bark' || name === 'twig' || name === 'ground') texture.colorSpace = SRGBColorSpace;
   texture.wrapS = texture.wrapT = RepeatWrapping;
   this.textureCache.set(name, texture); this.textures.add(texture);
  }).catch(error => {
   throw new Error(`Imported texture ${name} (${this.textureUrl(name)}) failed: ${error instanceof Error ? error.message : String(error)}`);
  }).finally(() => { this.texturePending.delete(name); });
  this.texturePending.set(name, pending);
  return pending;
 }

 private releaseTexture(texture: Texture): void {
  texture.dispose();
  const image: unknown = texture.source.data;
  if (image && typeof image === 'object' && !this.closedImages.has(image)) {
   this.closedImages.add(image);
   if ('close' in image && typeof image.close === 'function') image.close();
  }
  texture.source.data = null;
 }

 stats() {
  let triangles = 0, geometryBytes = 0;
  for (const geometry of this.geometries) {
   triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
   for (const attribute of Object.values(geometry.attributes)) geometryBytes += attribute.array.byteLength;
   geometryBytes += geometry.index?.array.byteLength ?? 0;
  }
  return { status: this.status, poseFrames: this.poseCount, bakedGeometries: this.geometries.size, geometryBytes, triangles, materials: this.materials.size, liveMixers: 0 };
 }

 private release(): void {
  for (const geometry of this.geometries) geometry.dispose();
  for (const material of this.materials) material.dispose();
  for (const texture of this.textures) this.releaseTexture(texture);
  for (const skeleton of this.skeletons) skeleton.dispose();
  this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.skeletons.clear();
  this.cycles.clear(); this.cached.clear(); this.textureCache.clear();
 }

 dispose(): void { if (this.status === 'disposed') return; this.status = 'disposed'; this.release(); }
}
