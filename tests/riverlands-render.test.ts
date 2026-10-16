import {expect,test} from 'vitest';
import {Scene,InstancedMesh} from 'three';
import {riverSurfaceMask,Riverlands} from '../src/render/riverlands3d';
import {terrainPixels,terrainSurfacePixels,scoutedFootprint} from '../src/render/terrain3d';
import {GroundCover} from '../src/render/ground-cover3d';
import {snapshot} from '../src/sim/visibility';
import {createGame} from '../src/sim/world';
import {createHash} from 'node:crypto';

test('river masks hide all unexplored water and crossings and orient northern rows correctly',()=>{
 const s={size:2,terrain:[3,4,5,0],fog:[2,1,0,0]};
 const mask=riverSurfaceMask(s);
 expect([...mask.slice(0,8)]).toEqual([0,0,0,255,0,0,0,255]);
 expect([...mask.slice(8,12)]).toEqual([255,0,255,255]);
 expect([...mask.slice(12,16)]).toEqual([255,255,106,255]);
 expect(riverSurfaceMask({...s,terrain:[3,4,0,5]})).toEqual(mask);
});

test('river and ford ground surfaces remain blue through settlement paths and are darkened in memory',()=>{
 const s={size:2,terrain:[3,4,5,0],fog:[2,1,2,2]};
 const detail=4,data=terrainSurfacePixels(s,new Uint8Array(256),detail,new Uint8Array(64).fill(255));
 const at=(x:number,y:number)=>[...data.slice(((8-1-y)*8+x)*4,((8-1-y)*8+x)*4+3)];
 const water=at(1,1),ford=at(5,1);expect(water[2]).toBeGreaterThan(water[0]);expect(ford[2]).toBeGreaterThan(ford[0]);
 const low=terrainPixels(s);expect(low[8+2]).toBeGreaterThan(low[8]);
 const hidden=terrainSurfacePixels({...s,fog:[0,0,0,0]},new Uint8Array(256));
 expect([...hidden.slice(0,4)]).toEqual([22,37,30,255]);
});

test('bridge decks and rails follow only known map tiles and release all owned resources',()=>{
 const scene=new Scene(),river=new Riverlands(scene),s={size:5,terrain:Array(25).fill(3),fog:Array(25).fill(0)};
 s.terrain[12]=5;s.terrain[11]=5;s.terrain[13]=5;
 river.update(s);expect(scene.children.filter(c=>c instanceof InstancedMesh).every(c=>(c as InstancedMesh).count===0)).toBe(true);
 s.fog=Array(25).fill(2);river.update(s);
 const decks=scene.children.find(c=>c.name==='River bridge decks') as InstancedMesh;expect(decks.count).toBe(3);
 expect((scene.children.find(c=>c.name==='River bridge rails') as InstancedMesh).count).toBeGreaterThan(0);
 s.fog=Array(25).fill(0);river.update(s);expect(decks.count).toBe(0);
 let disposed=0;decks.geometry.addEventListener('dispose',()=>disposed++);river.dispose();expect(disposed).toBe(1);expect(scene.children).toHaveLength(0);
});

test('cosmetic grass and pebbles never appear on water or permanent crossings',()=>{
 const s=snapshot(createGame({opponents:1,difficulty:'easy',seed:42})),scene=new Scene(),cover=new GroundCover(scene,60);
 s.fog.fill(2);s.terrain.fill(3);
 try{for(const terrain of [3,4,5]){s.terrain=Array(s.size*s.size).fill(terrain);s.tick++;cover.update(s,{x:20,y:20});expect(scene.children.every(c=>(c as InstancedMesh).count===0)).toBe(true);}}
 finally{cover.dispose();}
});

test('placement preview requires the entire footprint to be scouted before inspecting hidden terrain',()=>{
 const s={size:6,fog:Array(36).fill(2)};s.fog[14]=0;expect(scoutedFootprint(s,1,1,2)).toBe(false);s.fog[14]=1;expect(scoutedFootprint(s,1,1,2)).toBe(false);s.fog[14]=2;expect(scoutedFootprint(s,1,1,2)).toBe(true);expect(scoutedFootprint(s,5,5,2)).toBe(false);
});

test('optimized shoreline pixels preserve mixed fog, water, paths and ground exactly',()=>{
 const s={size:8,terrain:Array.from({length:64},(_,i)=>i%6),fog:Array.from({length:64},(_,i)=>(i*7)%3)},yard=Uint8Array.from({length:1024},(_,i)=>i%256);
 const data=terrainSurfacePixels(s,new Uint8Array(4096),4,yard);expect(createHash('sha256').update(data).digest('hex')).toBe('04822d00139572c75cb523c31b15a434eab304888cc15723a3467d040d37d6d3');
});
