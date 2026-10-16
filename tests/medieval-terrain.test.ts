import {expect,test} from 'vitest';
import {settlementSurfaceMask,terrainSurfacePixels} from '../src/render/terrain3d';
import {createGame,spawn} from '../src/sim/world';
import {snapshot} from '../src/sim/visibility';
import {GroundCover} from '../src/render/ground-cover3d';
import {Scene,InstancedMesh} from 'three';

test('settlement ground joins nearby buildings without drawing over unknown terrain',()=>{
 const s=createGame({opponents:1,difficulty:'easy',seed:42});
 const house=spawn(s,'building','house',0,{x:23,y:23}),size=s.size,detail=4;
 const mask=settlementSurfaceMask(size,Object.values(s.entities),detail);
 const sample=(x:number,y:number)=>mask[Math.floor(y*detail)*size*detail+Math.floor(x*detail)];
 expect(sample(house.x+.5,house.y+.5)).toBeGreaterThan(128);
 expect(sample(23,26)).toBeGreaterThan(0);
 expect(sample(50,50)).toBe(0);
 const base={size:2,terrain:[0,0,0,0],fog:[0,0,0,0]};
 const plain=terrainSurfacePixels(base,new Uint8Array(2*2*4*16));
 const hiddenYard=terrainSurfacePixels(base,new Uint8Array(plain.length),4,new Uint8Array(64).fill(255));
 expect(hiddenYard).toEqual(plain);
});

test('cosmetic cover disappears immediately when a paused snapshot loses visibility',()=>{
 const s=snapshot(createGame({opponents:1,difficulty:'easy',seed:42})),scene=new Scene(),cover=new GroundCover(scene,60);s.tick=100;s.fog.fill(2);
 try{
  cover.update(s,{x:20,y:20});expect((scene.children[0] as InstancedMesh).count).toBeGreaterThan(0);
  cover.update({...s,fog:s.fog.map(()=>0)},{x:20,y:20});expect(scene.children.every(mesh=>(mesh as InstancedMesh).count===0)).toBe(true);
  cover.update(s,{x:20,y:20});expect((scene.children[0] as InstancedMesh).count).toBeGreaterThan(0);cover.update(s,{x:20,y:20},new Uint8Array(s.size*s.size*16).fill(255));expect(scene.children.every(mesh=>(mesh as InstancedMesh).count===0)).toBe(true);
 }finally{cover.dispose();}expect(scene.children).toHaveLength(0);
});

test('the same visible land gets fine variation and settlement soil without random state changes',()=>{
 const s={size:3,terrain:Array(9).fill(0),fog:Array(9).fill(2)},n=3*3*4*16;
 const a=terrainSurfacePixels(s,new Uint8Array(n)),b=terrainSurfacePixels(s,new Uint8Array(n));
 expect(a).toEqual(b);
 const yard=terrainSurfacePixels(s,new Uint8Array(n),4,new Uint8Array(n/4).fill(255));
 expect(yard).not.toEqual(a);
 const invisible={...s,fog:Array(9).fill(0)};
 const dark=terrainSurfacePixels(invisible,new Uint8Array(n));
 expect([...dark.slice(0,4)]).toEqual([22,37,30,255]);
});
