import {OrthographicCamera,Raycaster,Plane,Vector2,Vector3} from 'three';
import type {Position} from '../sim/types';
export const PIXELS_PER_TILE=32*Math.SQRT2;
export class RTSCamera {
 readonly camera=new OrthographicCamera();private ray=new Raycaster();private plane=new Plane(new Vector3(0,1,0),0);private width=1;private height=1;
 configure(v:{width:number;height:number;focus:Position;zoom:number;yaw:number;origin:number}):void{
  this.width=Math.max(1,v.width);this.height=Math.max(1,v.height);const pixels=PIXELS_PER_TILE*v.zoom;
  this.camera.left=-this.width/2/pixels;this.camera.right=this.width/2/pixels;this.camera.top=this.height*v.origin/pixels;this.camera.bottom=-this.height*(1-v.origin)/pixels;this.camera.near=.1;this.camera.far=600;
  this.camera.position.set(v.focus.x+Math.sin(v.yaw)*100,100/Math.sqrt(3),v.focus.y+Math.cos(v.yaw)*100);this.camera.lookAt(v.focus.x,0,v.focus.y);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
 }
 project(p:Position,height=0):Position{const v=new Vector3(p.x,height,p.y).project(this.camera);return{x:(v.x+1)*this.width/2,y:(1-v.y)*this.height/2};}
 ground(p:Position,heightAt?:(x:number,y:number)=>number):Position{
  this.ray.setFromCamera(new Vector2(p.x/this.width*2-1,1-p.y/this.height*2),this.camera);const ray=this.ray.ray,v=ray.intersectPlane(this.plane,new Vector3());if(!v)return{x:0,y:0};if(!heightAt)return{x:v.x,y:v.z};
  // Walk down the bounded terrain column to find the first visible slope, then
  // refine its intersection. This avoids scanning a 256-square mesh per input.
  const at=(h:number)=>{const t=(h-ray.origin.y)/ray.direction.y;return{x:ray.origin.x+ray.direction.x*t,y:ray.origin.z+ray.direction.z*t};};
  let high=16;for(let h=15.75;h>=-.25;h-=.25){const q=at(h);if(h<=heightAt(q.x,q.y)){let low=h;for(let i=0;i<14;i++){const mid=(low+high)/2,a=at(mid);if(mid>heightAt(a.x,a.y))high=mid;else low=mid;}return at((low+high)/2);}high=h;}
  return{x:v.x,y:v.z};
 }
 groundFootprint(heightAt?:(x:number,y:number)=>number):Position[]{return[{x:0,y:0},{x:this.width,y:0},{x:this.width,y:this.height},{x:0,y:this.height}].map(p=>this.ground(p,heightAt));}
}
