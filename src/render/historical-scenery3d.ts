import { Box3, BufferGeometry, DoubleSide, Matrix4, Mesh, MeshStandardMaterial, SRGBColorSpace, Texture, TextureLoader, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { Entity } from '../sim/types';
import type { ModelPart } from './models3d';

type AssetLoader = (url: string) => Promise<GLTF>;
type MapLoader = (url: string) => Promise<Texture>;
const NAMES = ['oak-a', 'oak-b', 'pine', 'berries'] as const;

/** Authored 0 A.D. mesh/atlas derivatives; a fixed seven-template pool serves
 * every resource. No scene clones, geometry creation, animation, or entity state
 * changes occur during get(). This provider owns its maps and GPU resources. */
export class HistoricalScenery {
 status: 'idle' | 'loading' | 'ready' | 'failed' | 'disposed' = 'idle';
 error?: string;
 private pending?: Promise<void>;
 private templates: ModelPart[][] = [];
 private geometries = new Set<BufferGeometry>();
 private materials = new Set<MeshStandardMaterial>();
 private textures = new Set<Texture>();
 constructor(private loader: AssetLoader = url => new GLTFLoader().loadAsync(url), private mapLoader: MapLoader = url => new TextureLoader().loadAsync(url)) {}

 load(): Promise<void> {
  if (this.pending) return this.pending;
  if (this.status === 'disposed') return Promise.resolve();
  this.status = 'loading'; this.pending = this.loadAll(); return this.pending;
 }

 private async loadAll(): Promise<void> {
  const [scenes, maps] = await Promise.all([
   Promise.allSettled(NAMES.map(name => this.loader(`./models/historical-nature/${name}.glb`))),
   Promise.allSettled(NAMES.map(name => this.mapLoader(`./models/historical-nature/${name}.png`))),
  ]);
  const sourceGeometry = new Set<BufferGeometry>(), sourceMaterials = new Set<MeshStandardMaterial>();
  for (const scene of scenes) if (scene.status === 'fulfilled') scene.value.scene.traverse(node => {
   if (node instanceof Mesh) { sourceGeometry.add(node.geometry); for (const material of Array.isArray(node.material) ? node.material : [node.material]) sourceMaterials.add(material as MeshStandardMaterial); }
  });
  for (const map of maps) if (map.status === 'fulfilled') this.textures.add(map.value);
  try {
   if (this.status === 'disposed') { this.release(); return; }
   const failed = [...scenes, ...maps].find(result => result.status === 'rejected');
   if (failed?.status === 'rejected') throw failed.reason;
   for (let i = 0; i < NAMES.length; i++) {
    const source = (scenes[i] as PromiseFulfilledResult<GLTF>).value;
    const texture = (maps[i] as PromiseFulfilledResult<Texture>).value;
    texture.colorSpace = SRGBColorSpace; texture.flipY = false;
    // Material instances are shared by both size profiles of a given species.
    const materialCache = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    for (let profile = 0; profile < (i === 3 ? 1 : 2); profile++) {
     this.templates[i === 3 ? 6 : i + profile * 3] = this.bake(NAMES[i], source, texture, i === 3 ? 1.12 : profile ? 2.88 : 3.2, i === 3 ? .95 : profile ? 3.6 : 4, materialCache);
    }
   }
   this.status = 'ready';
  } catch (error) {
   this.error = `Historical scenery loading failed: ${error instanceof Error ? error.message : String(error)}`;
   this.status = 'failed'; this.release(); throw new Error(this.error);
  } finally {
   for (const geometry of sourceGeometry) geometry.dispose(); for (const material of sourceMaterials) material.dispose();
  }
 }

 private bake(name: string, source: GLTF, texture: Texture, width: number, height: number, materialCache: Map<MeshStandardMaterial, MeshStandardMaterial>): ModelPart[] {
  source.scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(source.scene), center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3());
  if (bounds.isEmpty() || size.y <= 0) throw new Error(`Empty historical scenery ${name}`);
  const scale = Math.min(width / Math.max(size.x, size.z), height / size.y);
  const transform = new Matrix4().makeScale(scale, scale, scale).multiply(new Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
  const parts: ModelPart[] = [];
  source.scene.traverse(node => {
   if (!(node instanceof Mesh)) return;
   if (Array.isArray(node.material)) throw new Error(`Unexpected grouped mesh ${name}`);
   const sourceMaterial = node.material as MeshStandardMaterial;
   let material = materialCache.get(sourceMaterial);
   if (!material) {
    material = sourceMaterial.clone(); material.map = texture; material.roughness = .96; material.metalness = 0;
    material.transparent = false; material.depthWrite = true;
    if (/foliage/.test(material.name)) { material.alphaTest = .45; material.side = DoubleSide; } else material.alphaTest = 0;
    materialCache.set(sourceMaterial, material); this.materials.add(material);
   }
   const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld).applyMatrix4(transform);
   if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
   geometry.computeBoundingBox(); geometry.computeBoundingSphere();
   geometry.userData.historicalScenery = true; geometry.userData.sourceAsset = name; this.geometries.add(geometry);
   parts.push({ geometry, material, position: [0,0,0], scale: [1,1,1], rotation: [0,0,0] });
  });
  return parts;
 }

 get(e: Entity, _age = 1, variant = e.id): ModelPart[] | undefined {
  if (this.status !== 'ready' || e.kind !== 'resource') return undefined;
  if (e.type === 'berries') return this.templates[6];
  if (e.type !== 'wood') return undefined;
  return this.templates[(Number.isFinite(variant) ? Math.abs(Math.floor(variant)) : 0) % 6];
 }

 metrics(): { geometries: number; materials: number; textures: number; templates: number; liveMixers: number } {
  return { geometries: this.geometries.size, materials: this.materials.size, textures: this.textures.size, templates: this.templates.length, liveMixers: 0 };
 }
 private release(): void {
  for (const geometry of this.geometries) geometry.dispose(); for (const material of this.materials) material.dispose(); for (const texture of this.textures) texture.dispose();
  this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.templates = [];
 }
 dispose(): void { if (this.status === 'disposed') return; this.status = 'disposed'; this.release(); }
}
