import { Box3, BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Entity } from '../sim/types';
import type { ModelPart } from './models3d';

type AssetLoader = (url: string) => Promise<GLTF>;
const TREES = ['CommonTree_1', 'BirchTree_1', 'PineTree_1', 'CommonTree_3'];
const ROCKS = ['Rock_1', 'Rock_3', 'Rock_Moss_2', 'Mountain_Single', 'Mountain_Group_1'];
export const SCENERY_ASSETS = [...new Set([...TREES, ...ROCKS, 'BushBerries_1', 'Resource_Gold_1'])];
const part = (geometry: BufferGeometry, material: MeshStandardMaterial): ModelPart => ({ geometry, material, position: [0, 0, 0], scale: [1, 1, 1], rotation: [0, 0, 0] });

/** Imported, grounded shared geometry. get() never clones a scene, mesh, geometry, or material. */
export class ImportedScenery {
 status: 'idle' | 'loading' | 'ready' | 'failed' | 'disposed' = 'idle';
 error?: string;
 private pending?: Promise<void>;
 private templates = new Map<string, ModelPart[]>();
 private cache = new Map<string, ModelPart[]>();
 private geometries = new Set<BufferGeometry>();
 private materials = new Set<MeshStandardMaterial>();
 constructor(private loader: AssetLoader = url => new GLTFLoader().loadAsync(url)) {}

 load(): Promise<void> {
  if (this.pending) return this.pending;
  if (this.status === 'disposed') return Promise.resolve();
  this.status = 'loading';
  this.pending = this.loadAll();
  return this.pending;
 }

 private async loadAll(): Promise<void> {
  const results = await Promise.allSettled(SCENERY_ASSETS.map(name => this.loader(`./models/realm/${name}.glb`)));
  const sources: GLTF[] = [];
  try {
   for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') sources.push(result.value);
   }
   if (this.status === 'disposed') return;
   const failed = results.findIndex(result => result.status === 'rejected');
   if (failed >= 0) throw new Error(`${SCENERY_ASSETS[failed]}.glb: ${(results[failed] as PromiseRejectedResult).reason}`);
   for (let i = 0; i < results.length; i++) this.bake(SCENERY_ASSETS[i], (results[i] as PromiseFulfilledResult<GLTF>).value);
   this.status = 'ready';
  } catch (error) {
   this.error = `Imported scenery loading failed: ${error instanceof Error ? error.message : String(error)}`;
   this.status = 'failed'; this.release(); throw new Error(this.error);
  } finally {
   const geometry = new Set<BufferGeometry>(), materials = new Set<MeshStandardMaterial>();
   for (const source of sources) source.scene.traverse(node => { if (node instanceof Mesh) { geometry.add(node.geometry); for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m as MeshStandardMaterial); } });
   for (const g of geometry) g.dispose(); for (const m of materials) m.dispose();
  }
 }

 private bake(name: string, source: GLTF): void {
  source.scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(source.scene), center = bounds.getCenter(new Vector3());
  if (bounds.isEmpty()) throw new Error(`Empty imported scenery ${name}`);
  const transform = new Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z);
  const groups = new Map<string, { material: MeshStandardMaterial; geometry: BufferGeometry[] }>();
  source.scene.traverse(node => {
   if (!(node instanceof Mesh)) return;
   const materials = Array.isArray(node.material) ? node.material : [node.material];
   const original = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
   original.applyMatrix4(node.matrixWorld).applyMatrix4(transform);
   if (!original.getAttribute('normal')) original.computeVertexNormals();
   const drawGroups = original.groups.length ? original.groups : [{ start: 0, count: original.getAttribute('position').count, materialIndex: 0 }];
   for (const group of drawGroups) {
    const sourceMaterial = materials[group.materialIndex ?? 0] as MeshStandardMaterial;
    const key = sourceMaterial.name || sourceMaterial.uuid;
    let bucket = groups.get(key);
    if (!bucket) { const material = sourceMaterial.clone(); material.roughness = .88; material.metalness = /metal|gold/i.test(key) ? .35 : 0; material.flatShading = true; this.materials.add(material); bucket = { material, geometry: [] }; groups.set(key, bucket); }
    const geometry = new BufferGeometry();
    for (const attributeName of ['position', 'normal', 'color', 'uv']) {
     const attribute = original.getAttribute(attributeName), values: number[] = [];
     if (!attribute) continue;
     for (let v = group.start; v < group.start + group.count; v++) for(let axis=0;axis<attribute.itemSize;axis++) values.push(attribute.getComponent(v,axis));
     geometry.setAttribute(attributeName, new Float32BufferAttribute(values, attribute.itemSize));
    }
    bucket.geometry.push(geometry);
   }
   original.dispose();
  });
  const parts: ModelPart[] = [];
  for (const { material, geometry: geometries } of groups.values()) {
   const geometry = mergeGeometries(geometries, false); for (const g of geometries) g.dispose();
   if (!geometry) throw new Error(`Cannot merge imported scenery ${name}`);
   geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometry.userData.importedScenery = true; geometry.userData.sourceAsset = name;
   this.geometries.add(geometry); parts.push(part(geometry, material));
  }
  this.templates.set(name, parts);
 }

 private fitted(name: string, width: number, height: number): ModelPart[] {
  const key = `${name}:${width}:${height}`, found = this.cache.get(key); if (found) return found;
  const original = this.templates.get(name)!;
  const bounds = new Box3(); for (const p of original) bounds.union(p.geometry.boundingBox!);
  const size = bounds.getSize(new Vector3()), scale = Math.min(width / Math.max(size.x, size.z), height / size.y);
  const parts: ModelPart[] = [];
  for (const p of original) {
   const geometry=p.geometry.clone().scale(scale,scale,scale);geometry.computeBoundingBox();geometry.computeBoundingSphere();this.geometries.add(geometry);
   parts.push(part(geometry,p.material));
  }
  this.cache.set(key,parts);return parts;
 }

 get(e: Entity, _age = 1, variant = 0): ModelPart[] | undefined {
  if (this.status !== 'ready') return undefined;
  const choice = Math.abs(Math.floor(variant));
  if (e.kind === 'resource') {
   if (e.type === 'wood') return this.fitted(TREES[choice % TREES.length], 1.75, 3.8);
   if (e.type === 'berries') return this.fitted('BushBerries_1', 1.12, .95);
   if (e.type === 'stone') return this.fitted(ROCKS[choice % ROCKS.length], .96, choice % ROCKS.length >= 3 ? 1.25 : .7);
   if (e.type === 'gold') return this.fitted('Resource_Gold_1', .96, .8);
   return undefined;
  }
  return undefined;
 }

 stats(): { bakedGeometries: number; cachedVariants: number; templates: number; liveMixers: number } { return { bakedGeometries: this.geometries.size, cachedVariants: this.cache.size, templates: this.templates.size, liveMixers: 0 }; }
 private release(): void { for (const g of this.geometries) g.dispose(); for (const m of this.materials) m.dispose(); this.geometries.clear(); this.materials.clear(); this.templates.clear(); this.cache.clear(); }
 dispose(): void { if (this.status === 'disposed') return; this.status = 'disposed'; this.release(); }
}
