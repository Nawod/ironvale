import {expect,it} from 'vitest';
import {DataTexture,RGBAFormat} from 'three';
import {createGame,spawn} from '../src/sim/world';
import {snapshot} from '../src/sim/visibility';
import {createLandscapeFields,landscapeStylePixels} from '../src/render/landscape-surface';
import {terrainSurfacePixels,settlementSurfaceMask,terrainFogChange} from '../src/render/terrain3d';
import {MedievalTerrain} from '../src/render/medieval-terrain3d';

it('uses known tree/deposit beds and historical building ages without changing simulation or snapshot state',()=>{
 const world=createGame({opponents:1,difficulty:'easy',seed:42,mapType:'lowlands'}),tree=spawn(world,'resource','wood',-1,{x:35,y:35}),rock=spawn(world,'resource','stone',-1,{x:39,y:35});
 const s=snapshot(world);s.fog.fill(2);s.entities.push(tree,rock);const cap=s.entities.find(e=>e.type==='capital'&&e.owner===0)!;cap.visualAge=1;s.players[0].age=3;
 const before=JSON.stringify(s),first=createLandscapeFields(s),width=s.size*4,at=(x:number,y:number)=>Math.floor(y*4)*width+Math.floor(x*4);
 expect(first.woodland[at(35.5,35.5)]).toBeGreaterThan(0);expect(first.rock[at(39.5,35.5)]).toBeGreaterThan(0);expect(first.paving[at(cap.x+1,cap.y+1)]).toBe(0);expect(JSON.stringify(s)).toBe(before);
 cap.visualAge=2;expect(createLandscapeFields(s).paving[at(cap.x+1,cap.y+1)]).toBeGreaterThan(200);
});
it('is deterministic, seed-sensitive and leaves unknown ground independent of hidden terrain or entities',()=>{
 const s=snapshot(createGame({opponents:1,difficulty:'easy',seed:42,mapType:'lowlands'}));s.fog.fill(0);s.fog[20*s.size+20]=2;s.entities=[];
 const first=createLandscapeFields(s),repeat=createLandscapeFields(s);expect(first).toEqual(repeat);
 const altered={...s,terrain:s.terrain.map((t,i)=>s.fog[i]?t:3),entities:[{...spawn(createGame({opponents:1,difficulty:'easy',seed:1}),'building','capital',1,{x:21,y:20}),visualAge:3 as const}]};
 expect(createLandscapeFields(altered)).toEqual(first);
 expect(createLandscapeFields({...s,config:{...s.config,seed:43}}).moisture).not.toEqual(first.moisture);
 const pixels=landscapeStylePixels(s,first);for(let y=0;y<s.size*4;y++)for(let x=0;x<s.size*4;x++){if(s.fog[Math.floor(y/4)*s.size+Math.floor(x/4)])continue;const i=((s.size*4-1-y)*s.size*4+x)*4;expect([...pixels.slice(i,i+4)]).toEqual([0,0,0,255]);}
});
it('adds meadow and paved-town surfaces while retaining water, crossings and constant unexplored colors',()=>{
 const s=snapshot(createGame({opponents:1,difficulty:'easy',seed:42,mapType:'riverlands'}));s.fog.fill(2);s.entities.find(e=>e.type==='capital'&&e.owner===0)!.visualAge=2;
 const yard=settlementSurfaceMask(s.size,s.entities),fields=createLandscapeFields(s),n=s.size*s.size*64;
 const original=terrainSurfacePixels(s,new Uint8Array(n),4,yard),richer=terrainSurfacePixels(s,new Uint8Array(n),4,yard,fields);expect(richer).not.toEqual(original);expect(richer).toEqual(terrainSurfacePixels(s,new Uint8Array(n),4,yard,fields));
 for(let tile=0;tile<s.terrain.length;tile++)if(s.terrain[tile]>=3){const x=(tile%s.size)*4+1,y=Math.floor(tile/s.size)*4+1,i=((s.size*4-1-y)*s.size*4+x)*4;expect(richer.slice(i,i+4)).toEqual(original.slice(i,i+4));}
 s.fog.fill(0);const hidden=terrainSurfacePixels(s,new Uint8Array(n),4,yard,createLandscapeFields(s));expect([...hidden.slice(0,4)]).toEqual([22,37,30,255]);
});
it('binds fog-safe paving to the ground shader and disposes its extra texture',()=>{
 const s=snapshot(createGame({opponents:1,difficulty:'easy',seed:42})),map=new DataTexture(new Uint8Array(64),4,4,RGBAFormat),ground=new MedievalTerrain(map,s.size),fields=createLandscapeFields(s);
 ground.updateSurface(s,fields);const shader:any={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'void main() {\n#include <map_fragment>\n}'};ground.material.onBeforeCompile(shader,{} as any);expect(shader.fragmentShader).toContain('cobble');expect(shader.fragmentShader).toContain('terrainCliff');expect(shader.vertexShader).toContain('terrainWorld=');expect(shader.uniforms.medievalSurface.value.image.width).toBe(s.size*4);
 let disposed=0;shader.uniforms.medievalSurface.value.addEventListener('dispose',()=>disposed++);ground.dispose();map.dispose();expect(disposed).toBe(1);
});
it('updates a local fog patch exactly like a full surface pass, including its visible neighbors',()=>{
 const s=snapshot(createGame({opponents:1,difficulty:'easy',seed:42,mapType:'riverlands'}));s.fog.fill(1);const prior=Uint8Array.from(s.fog),yard=settlementSurfaceMask(s.size,s.entities),fields=createLandscapeFields(s),data=terrainSurfacePixels(s,new Uint8Array(s.size*s.size*64),4,yard,fields);
 for(let y=27;y<=29;y++)for(let x=43;x<=45;x++)s.fog[y*s.size+x]=2;
 const delta=terrainFogChange(s.fog,prior,s.size);expect(delta.changed).toBe(true);expect(delta.knowledgeChanged).toBe(false);expect(delta.region).toEqual({x0:42,y0:26,x1:47,y1:31});
 terrainSurfacePixels(s,data,4,yard,fields,delta.region);expect(data).toEqual(terrainSurfacePixels(s,new Uint8Array(data.length),4,yard,fields));
 expect(terrainFogChange(s.fog,Uint8Array.from(s.fog),s.size).changed).toBe(false);
});
it('requires fresh knowledge-dependent surfaces when an unexplored tile is revealed',()=>{
 const before=new Uint8Array(25).fill(1),fog=[...before];fog[12]=0;const initial=terrainFogChange(fog,undefined,5);expect(initial.changed).toBe(true);expect(initial.knowledgeChanged).toBe(true);expect(initial.region).toBeUndefined();
 const reveal=terrainFogChange(before,Uint8Array.from(fog),5);expect(reveal.knowledgeChanged).toBe(true);expect(reveal.region).toEqual({x0:1,y0:1,x1:4,y1:4});
});
