import {expect,it} from 'vitest';
import {RTSCamera} from '../src/render/camera3d';
import {clipMapViewport} from '../src/render/minimap-viewport';

it('tracks camera pan, zoom and rotation with actual ground intersections',()=>{
 const camera=new RTSCamera(),config={width:1440,height:900,focus:{x:48,y:48},zoom:1.1,yaw:Math.PI/4,origin:.42};camera.configure(config);
 const original=camera.groundFootprint();expect(original).toHaveLength(4);
 for(const [i,p]of original.entries()){const screen=camera.project(p);expect(screen.x).toBeCloseTo([0,1440,1440,0][i],6);expect(screen.y).toBeCloseTo([0,0,900,900][i],6);}
 camera.configure({...config,focus:{x:51,y:46}});expect(camera.groundFootprint()[0].x-original[0].x).toBeCloseTo(3);expect(camera.groundFootprint()[0].y-original[0].y).toBeCloseTo(-2);
 camera.configure({...config,zoom:2.2});const zoomed=camera.groundFootprint();expect(Math.hypot(zoomed[0].x-zoomed[1].x,zoomed[0].y-zoomed[1].y)).toBeCloseTo(Math.hypot(original[0].x-original[1].x,original[0].y-original[1].y)/2);
 camera.configure({...config,yaw:1.2});expect(camera.groundFootprint()).not.toEqual(original);
});
it('clips a camera crossing map edges without inventing diagonal corners or mutating points',()=>{
 const points=[{x:-5,y:5},{x:5,y:-5},{x:15,y:5},{x:5,y:15}],before=structuredClone(points),clipped=clipMapViewport(points,10);
 expect(clipped).toHaveLength(4);expect(clipped.every(p=>p.x>=0&&p.x<=10&&p.y>=0&&p.y<=10)).toBe(true);expect(clipped).toEqual(expect.arrayContaining([{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]));expect(points).toEqual(before);
 expect(clipMapViewport([{x:NaN,y:2}],10)).toEqual([]);expect(clipMapViewport(points,0)).toEqual([]);
});
