import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {snapshot} from '../src/sim/visibility';
import {wallPlanPreview} from '../src/render/wall-planning';
import {TERRAIN} from '../src/sim/terrain';

function view(){const s=createGame({opponents:1,difficulty:'easy',seed:42});s.terrain.fill(0);s.entities={};s.players[0].resources={food:1000,wood:1000,stone:1000,gold:1000};s.players[0].age=2;s.visible[0].fill(1);s.explored[0].fill(1);return s;}
it('previews an L route and charges only new tiles across mixed owned walls',()=>{
 const s=view();spawn(s,'building','wall',0,{x:20,y:20});const unfinished=spawn(s,'building','palisade',0,{x:21,y:20});unfinished.progress=.1;
 const p=wallPlanPreview(snapshot(s),'palisade',{x:20,y:20},{x:23,y:22});
 expect(p.tiles).toHaveLength(6);expect(p.reused).toBe(2);expect(p.cost).toEqual({wood:32});expect(p.error).toBeUndefined();expect(p.tiles.every(t=>t.valid)).toBe(true);
});
it('checks full scouting before reading hidden terrain or entities',()=>{
 const s=view(),v=snapshot(s);v.fog[20*s.size+23]=1;
 Object.defineProperty(v,'terrain',{get(){throw new Error('hidden terrain read');}});Object.defineProperty(v,'entities',{get(){throw new Error('hidden occupancy read');}});
 const p=wallPlanPreview(v,'wall',{x:20,y:20},{x:23,y:20});expect(p.error).toContain('Scout');expect(p.tiles.every(t=>!t.valid)).toBe(true);expect(p.cost).toEqual({});
});
it('marks resources, water and bridges blocked and another city cannot be reused',()=>{
 const s=view();spawn(s,'resource','stone',-1,{x:21.4,y:20.4});spawn(s,'building','palisade',1,{x:22,y:20});s.terrain[20*s.size+23]=TERRAIN.water;s.terrain[20*s.size+24]=TERRAIN.bridge;
 const p=wallPlanPreview(snapshot(s),'palisade',{x:20,y:20},{x:24,y:20});expect(p.error).toContain('clear land');expect(p.tiles.map(t=>t.valid)).toEqual([true,false,false,false,false]);expect(p.reused).toBe(0);
});
it('reports affordability, age, completed-only routes and oversized routes',()=>{
 const s=view();s.players[0].resources.wood=7;expect(wallPlanPreview(snapshot(s),'palisade',{x:20,y:20},{x:20,y:20}).error).toContain('resources');
 s.players[0].age=1;expect(wallPlanPreview(snapshot(s),'wall',{x:20,y:20},{x:20,y:20}).error).toContain('town hall');
 spawn(s,'building','palisade',0,{x:20,y:20});expect(wallPlanPreview(snapshot(s),'palisade',{x:20,y:20},{x:20,y:20}).error).toContain('already built');
 expect(wallPlanPreview(snapshot(s),'palisade',{x:2,y:2},{x:90,y:90}).error).toContain('64');
});
