import {expect,test} from 'vitest';
import {InstancedMesh,MeshStandardMaterial,Scene} from 'three';
import type {Entity,Snapshot} from '../src/sim/types';
import {TERRAIN} from '../src/sim/terrain';
import {LandscapeDetails,planLandscapeDetails} from '../src/render/landscape-details3d';

function map(size=48):Snapshot{
 return {size,terrain:Array(size*size).fill(TERRAIN.grass),fog:Array(size*size).fill(2),entities:[],tick:20,paused:true,playerId:0,players:[],events:[],winner:null,config:{opponents:1,difficulty:'easy',seed:123},population:0,capacity:0};
}
const focus={x:24,y:24};

test('cosmetic placements are deterministic, small, local and obey the combined cap',()=>{
 const s=map(),before=JSON.stringify(s),a=planLandscapeDetails(s,focus,undefined,17);
 expect(a.length).toBe(17);expect(planLandscapeDetails(s,focus,undefined,17)).toEqual(a);expect(JSON.stringify(s)).toBe(before);
 for(const p of a){expect(Math.hypot(p.x-focus.x,p.y-focus.y)).toBeLessThanOrEqual(23);expect(p.scale).toBeGreaterThan(0);expect(p.scale).toBeLessThan(1.4);expect(p.kind).toBe('flowers');}
 expect(planLandscapeDetails(s,focus,undefined,0)).toEqual([]);
});

test('hidden and remembered tiles and neighbors cannot disclose terrain through plant choices',()=>{
 const s=map();for(let y=0;y<s.size;y++)for(let x=24;x<s.size;x++)s.fog[y*s.size+x]=x===24?1:0;
 const a=planLandscapeDetails(s,focus);
 const changed={...s,terrain:s.terrain.map((t,i)=>s.fog[i]===2?t:TERRAIN.water)};
 expect(planLandscapeDetails(changed,focus)).toEqual(a);
 expect(a.length).toBeGreaterThan(0);expect(a.every(p=>s.fog[Math.floor(p.y)*s.size+Math.floor(p.x)]===2)).toBe(true);
});

test('hidden settlement pixels do not suppress a visible shoreline clump',()=>{
 const s=map();for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
  if(x===23)s.terrain[y*s.size+x]=TERRAIN.water;
  if(x===21||x>=25)s.fog[y*s.size+x]=0;
 }
 const yard=new Uint8Array(s.size*s.size*16),a=planLandscapeDetails(s,focus,yard);
 for(let y=0;y<s.size*4;y++)for(let x=0;x<s.size*4;x++)if(s.fog[Math.floor(y/4)*s.size+Math.floor(x/4)]!==2)yard[y*s.size*4+x]=255;
 expect(planLandscapeDetails(s,focus,yard)).toEqual(a);
});

test('reeds occupy dry known banks, lilies deep water near known banks, ferns woodland and all crossings stay clear',()=>{
 const s=map();for(let y=0;y<s.size;y++)for(let x=18;x<=28;x++)s.terrain[y*s.size+x]=TERRAIN.water;
 for(let y=30;y<40;y++)for(let x=5;x<15;x++)s.terrain[y*s.size+x]=TERRAIN.woodland;
 for(let x=18;x<=28;x++){s.terrain[20*s.size+x]=TERRAIN.bridge;s.terrain[27*s.size+x]=TERRAIN.ford;}
 const points=planLandscapeDetails(s,focus,undefined,480),kinds=new Set(points.map(p=>p.kind));
 expect([...kinds]).toEqual(expect.arrayContaining(['reeds','lilies','flowers','ferns']));
 for(const p of points){const x=Math.floor(p.x),y=Math.floor(p.y),t=s.terrain[y*s.size+x];
  expect(t).not.toBe(TERRAIN.ford);expect(t).not.toBe(TERRAIN.bridge);
  if(p.kind==='lilies')expect(t).toBe(TERRAIN.water);else expect(t).toBeLessThan(TERRAIN.water);
  if(p.kind==='ferns')expect(t).toBe(TERRAIN.woodland);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const t=s.terrain[(y+dy)*s.size+x+dx];expect(t).not.toBe(TERRAIN.ford);expect(t).not.toBe(TERRAIN.bridge);}
 }
});

test('plants leave live building footprints, resource trunks and strong settlement routes clear',()=>{
 const s=map();s.entities=[{id:1,kind:'building',type:'capital',x:20,y:20,hp:100,ghost:false} as Entity,{id:2,kind:'resource',type:'wood',x:27,y:24,hp:1} as Entity];
 const yard=new Uint8Array(s.size*s.size*16);for(let y=0;y<s.size*4;y++)for(let x=23*4;x<26*4;x++)yard[y*s.size*4+x]=255;
 const points=planLandscapeDetails(s,focus,yard);expect(points.length).toBeGreaterThan(0);
 for(const p of points){expect(p.x<19.7||p.x>23.3||p.y<19.7||p.y>23.3).toBe(true);expect(p.x<22.8||p.x>26.2).toBe(true);expect(Math.hypot(p.x-27,p.y-24)).toBeGreaterThan(.5);}
});

test('paused renderer refreshes fog, terrain and settlement changes and releases every owned resource',()=>{
 const s=map(),scene=new Scene(),details=new LandscapeDetails(scene,31);details.update(s,focus);
 const meshes=scene.children as InstancedMesh[];expect(meshes).toHaveLength(4);expect(details.metrics().total).toBe(31);expect(meshes.reduce((n,m)=>n+m.count,0)).toBe(31);
 for(const m of meshes){expect(m.geometry.getAttribute('color')).toBeDefined();expect((m.material as MeshStandardMaterial).transparent).toBe(false);}
 s.fog.fill(1);details.update(s,focus);expect(details.metrics().total).toBe(0);
 s.fog=Array(s.size*s.size).fill(2);details.update(s,focus);expect(details.metrics().total).toBeGreaterThan(0);
 s.terrain=Array(s.size*s.size).fill(TERRAIN.bridge);details.update(s,focus);expect(details.metrics().total).toBe(0);
 s.terrain=Array(s.size*s.size).fill(TERRAIN.grass);details.update(s,focus);expect(details.metrics().total).toBeGreaterThan(0);
 details.update(s,focus,new Uint8Array(s.size*s.size*16).fill(255));expect(details.metrics().total).toBe(0);
 let geometry=0,material=0,instances=0;for(const m of meshes){m.geometry.addEventListener('dispose',()=>geometry++);(m.material as MeshStandardMaterial).addEventListener('dispose',()=>material++);m.addEventListener('dispose',()=>instances++);}
 details.dispose();expect(scene.children).toHaveLength(0);expect(geometry).toBe(4);expect(material).toBe(4);expect(instances).toBe(4);expect(details.metrics().total).toBe(0);
});
