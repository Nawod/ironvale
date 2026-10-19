import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, MeshStandardMaterial, SRGBColorSpace, Texture, TextureLoader, Uint16BufferAttribute } from 'three';
import { COLORS } from '../sim/definitions';
import type { Entity } from '../sim/types';
import type { ImportedPoseOptions } from './imported-models3d';
import type { ModelPart } from './models3d';

type Action = 'idle' | 'walk' | 'work' | 'attack';
interface Slice { offset: number; count: number }
interface PackedGeometry { position: Slice; uv: Slice; index: Slice; attachment: boolean }
interface PackedPart { geometry: number; role: string }
interface Cycle { duration: number; frames: PackedPart[][] }
interface Outfit { variants: Record<string, string>[]; cycles: Record<Action, Cycle> }
interface CharacterBank { version: number; geometries: PackedGeometry[]; sets: Record<string, Outfit>; binary: string }
type JsonLoader = (url: string) => Promise<CharacterBank>;
type BytesLoader = (url: string) => Promise<ArrayBuffer>;
type ImageLoader = (url: string) => Promise<Texture>;
const BASE = './models/historical/';

/** Native 0 A.D. art and skeletal clips sampled offline. All lookups reuse finite
 * geometry/material banks; no live skeletons, mixers or per-entity GPU resources.
 */
export class HistoricalModels {
 status: 'idle' | 'loading' | 'ready' | 'failed' | 'disposed' = 'idle';
 error?: string;
 private pending?: Promise<void>;
 private bank?: CharacterBank;
 private geometries: BufferGeometry[] = [];
 private materials = new Map<string, MeshStandardMaterial>();
 private textures = new Map<string, Texture>();
 private frames = new Map<string, ModelPart[]>();

 constructor(
  private json: JsonLoader = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); return response.json(); },
  private bytes: BytesLoader = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); return response.arrayBuffer(); },
  private image: ImageLoader = url => new TextureLoader().loadAsync(url),
 ) {}

 load(): Promise<void> {
  if (this.pending) return this.pending;
  if (this.status === 'disposed') return Promise.resolve();
  this.status = 'loading';
  this.pending = this.loadAll();
  return this.pending;
 }

 private async loadAll(): Promise<void> {
  try {
   const bank = await this.json(`${BASE}characters.json`);
   if (bank.version !== 1) throw new Error('Unsupported historical character bank');
   const data = await this.bytes(BASE + bank.binary);
   const paths = [...new Set(Object.values(bank.sets).flatMap(outfit => outfit.variants.flatMap(variant => Object.values(variant))))].filter(Boolean);
   const results = await Promise.allSettled(paths.map(async path => ({ path, texture: await this.image(BASE + path) })));
   for (const result of results) if (result.status === 'fulfilled') {
    const { path, texture } = result.value; texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4; this.textures.set(path, texture);
   }
   if ((this.status as string) === 'disposed') { this.release(); return; }
   const failure = results.find(result => result.status === 'rejected');
   if (failure?.status === 'rejected') throw failure.reason;
   this.bank = bank;
   for (const packed of bank.geometries) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(data, packed.position.offset, packed.position.count), 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(data, packed.uv.offset, packed.uv.count), 2));
    geometry.setIndex(new Uint16BufferAttribute(new Uint16Array(data, packed.index.offset, packed.index.count), 1));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.historicalActor = true; geometry.userData.importedActor = true;
    geometry.userData.importedAttachment = packed.attachment;
    this.geometries.push(geometry);
   }
   // Prepare every combination during startup so get() is allocation free.
   for (const [type, outfit] of Object.entries(bank.sets)) for (let variant = 0; variant < outfit.variants.length; variant++) {
    for (let owner = 0; owner < COLORS.length; owner++) for (const [action, cycle] of Object.entries(outfit.cycles)) {
     cycle.frames.forEach((parts, index) => {
      this.frames.set(`${type}:${variant}:${owner}:${action}:${index}`, parts.map(part => ({
       geometry: this.geometries[part.geometry], material: this.material(outfit.variants[variant][part.role], part.role, owner, variant),
       position: [0, 0, 0], scale: [1, 1, 1], rotation: [0, 0, 0],
      })));
     });
    }
   }
   this.status = 'ready';
  } catch (error) {
   if ((this.status as string) === 'disposed') { this.release(); return; }
   this.error = error instanceof Error ? error.message : String(error); this.status = 'failed'; this.release();
  }
 }

 private material(path: string, role: string, owner: number, variant: number): MeshStandardMaterial {
  const team = role === 'body' || role === 'shield';
  const key = `${path}:${role}:${team ? owner : 0}:${role === 'head' ? variant : 0}`;
  let material = this.materials.get(key);
  if (material) return material;
  material = new MeshStandardMaterial({ name: `0 A.D. ${role}${team ? ` city ${owner}` : ''}`, map: this.textures.get(path), roughness: role === 'helmet' ? .52 : .9, metalness: role === 'helmet' ? .45 : 0, side: DoubleSide });
  // 0 A.D. diffuse alpha encodes authored color islands, not transparency.
  // Only cloth/shield islands receive city color; faces, skin and metal keep art.
  const tint = new Color(team ? COLORS[owner] : role === 'head' ? ['#604529', '#98713e', '#c4984a'][variant % 3] : '#ffffff');
  material.onBeforeCompile = shader => {
   shader.uniforms.historicalTint = { value: tint };
   shader.fragmentShader = `uniform vec3 historicalTint;\n${shader.fragmentShader}`;
   shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
    #ifdef USE_MAP
     vec4 historicalSample = texture2D(map, vMapUv);
     diffuseColor.rgb *= historicalSample.rgb * mix(historicalTint, vec3(1.0), historicalSample.a);
    #endif
   `);
  };
  material.customProgramCacheKey = () => 'historical-playercolor-v1';
  material.userData.historicalRole = role; material.userData.historicalTeamMask = team;
  this.materials.set(key, material); return material;
 }

 get(entity: Entity, options: ImportedPoseOptions): ModelPart[] | undefined {
  if (this.status !== 'ready' || entity.kind !== 'unit') return;
  const type = String(entity.type);
  const outfit = this.bank?.sets[type]; if (!outfit) return;
  const action: Action = options.attacking ? 'attack' : options.working ? 'work' : options.moving ? 'walk' : 'idle';
  const cycle = outfit.cycles[action];
  const time = Number.isFinite(options.time) ? options.time : 0;
  const phase = ((time + (entity.id % 17) * .073) % cycle.duration + cycle.duration) % cycle.duration;
  // Dense armies share two native phases (0 and 4), cutting animation batch
  // combinations without extra geometry or changing outfit/city materials.
  const phaseCount = options.detail === 'crowd' ? Math.min(2, cycle.frames.length) : cycle.frames.length;
  const index = Math.min(cycle.frames.length - 1, Math.floor(phase / cycle.duration * phaseCount) * Math.floor(cycle.frames.length / phaseCount));
  const variant = ((entity.id % outfit.variants.length) + outfit.variants.length) % outfit.variants.length;
  const owner = Math.max(0, entity.owner) % COLORS.length;
  return this.frames.get(`${type}:${variant}:${owner}:${action}:${index}`);
 }

 metrics() {
  let triangles = 0, geometryBytes = 0;
  for (const geometry of this.geometries) {
   triangles += (geometry.index?.count ?? 0) / 3;
   for (const attribute of Object.values(geometry.attributes)) geometryBytes += attribute.array.byteLength;
   geometryBytes += geometry.index?.array.byteLength ?? 0;
  }
  return { status: this.status, geometries: this.geometries.length, geometryBytes, triangles, materials: this.materials.size, textures: this.textures.size, cachedFrames: this.frames.size, liveMixers: 0 };
 }

 private release(): void {
  for (const geometry of this.geometries) geometry.dispose();
  for (const material of this.materials.values()) material.dispose();
  for (const texture of this.textures.values()) { texture.dispose(); const image = texture.source.data; if (image && typeof image === 'object' && 'close' in image && typeof image.close === 'function') image.close(); texture.source.data = null; }
  this.geometries.length = 0; this.materials.clear(); this.textures.clear(); this.frames.clear(); this.bank = undefined;
 }
 dispose(): void { if (this.status === 'disposed') return; this.status = 'disposed'; this.release(); }
}
