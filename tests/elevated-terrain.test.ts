import {expect,it} from 'vitest';
import {Scene,InstancedMesh,Matrix4} from 'three';
import {elevatedGeometry,updateElevation} from '../src/render/elevated-terrain3d';
import {RTSCamera} from '../src/render/camera3d';
import {terrainHeight} from '../src/sim/terrain';
import {GroundCover} from '../src/render/ground-cover3d';
import {snapshot} from '../src/sim/visibility';
import {createGame} from '../src/sim/world';

it('builds actual height geometry with slope normals and hides unexplored landforms',()=>{
 const s={size:2,fog:[2,2,0,0],elevation:[0,1,2,1,3,4,7,8,9]},g=elevatedGeometry(s),p=g.getAttribute('position');
 expect(p.count).toBe(9);expect(p.getZ(1)).toBe(1);expect(p.getZ(4)).toBe(3);expect(p.getZ(8)).toBe(0);
 expect(g.getAttribute('normal').getX(1)).not.toBe(0);expect(s.elevation[8]).toBe(9);
 updateElevation(g,{...s,fog:[2,2,2,2]});expect(p.getZ(8)).toBe(9);g.dispose();
});

it('projects and targets the elevated surface rather than the plane below it',()=>{
 const c=new RTSCamera(),s={size:4,elevation:Array(25).fill(1.5)};c.configure({width:1200,height:800,focus:{x:2,y:2},zoom:1,yaw:Math.PI/4,origin:.42});
 for(const p of [{x:1,y:1},{x:3,y:2}]){const screen=c.project(p,terrainHeight(s,p.x,p.y)),hit=c.ground(screen,(x,y)=>terrainHeight(s,x,y));expect(hit.x).toBeCloseTo(p.x,3);expect(hit.y).toBeCloseTo(p.y,3);}
});

it('places small ground scenery on the actual hill surface',()=>{
 const s=snapshot(createGame({opponents:1,difficulty:'easy',seed:42}));s.fog.fill(2);s.terrain.fill(0);s.elevation=Array((s.size+1)**2).fill(1.25);const scene=new Scene(),cover=new GroundCover(scene,20);cover.update(s,{x:20,y:20});
 const grass=scene.children[0] as InstancedMesh,m=new Matrix4();expect(grass.count).toBeGreaterThan(0);grass.getMatrixAt(0,m);expect(m.elements[13]).toBeCloseTo(1.25);cover.dispose();
});
