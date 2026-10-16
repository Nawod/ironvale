import {BufferGeometry,Color,CylinderGeometry,DoubleSide,Float32BufferAttribute,InstancedMesh,MeshStandardMaterial,Object3D,OctahedronGeometry,Scene} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BUILDINGS} from '../sim/definitions';
import {TERRAIN} from '../sim/terrain';
import type {Position,Snapshot} from '../sim/types';

export type LandscapeKind='reeds'|'lilies'|'flowers'|'ferns';
export interface LandscapePlacement extends Position {kind:LandscapeKind;angle:number;scale:number}
const kinds:LandscapeKind[]=['reeds','lilies','flowers','ferns'];
const radius=22,offsets:{x:number;y:number;distance:number}[]=[];
for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++)if(x*x+y*y<=radius*radius)offsets.push({x,y,distance:x*x+y*y});
offsets.sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);
const hash=(x:number,y:number)=>(Math.imul(x+31,73856093)^Math.imul(y+53,19349663))>>>0;
const capacity=(limit:number)=>Number.isFinite(limit)?Math.max(0,Math.floor(limit)):480;

/** Pure visual sampling. Every terrain read follows a current-visibility check,
 * including shoreline and crossing neighbors, so ornaments cannot reveal intel. */
export function planLandscapeDetails(s:Snapshot,focus:Position,settlement?:Uint8Array,limit=480):LandscapePlacement[]{
 const result:LandscapePlacement[]=[],cap=capacity(limit);if(!cap)return result;
 const known=(x:number,y:number)=>x>=0&&y>=0&&x<s.size&&y<s.size&&s.fog[y*s.size+x]===2;
 const blocked=new Set<number>();
 for(const e of s.entities){
  if(e.hp<=0||e.ghost||Math.abs(e.x-focus.x)>radius+6||Math.abs(e.y-focus.y)>radius+6)continue;
  const n=e.kind==='building'?BUILDINGS[e.type as keyof typeof BUILDINGS]?.size:0;
  if(!n&&!(e.kind==='resource'&&e.type==='wood'))continue;
  const pad=n?.3:.55;
  for(let y=Math.max(0,Math.floor(e.y-pad));y<Math.min(s.size,Math.ceil(e.y+(n||0)+pad));y++)for(let x=Math.max(0,Math.floor(e.x-pad));x<Math.min(s.size,Math.ceil(e.x+(n||0)+pad));x++)if(known(x,y))blocked.add(y*s.size+x);
 }
 const cx=Math.floor(focus.x),cy=Math.floor(focus.y);
 for(const o of offsets){
  if(result.length>=cap)break;
  const x=cx+o.x,y=cy+o.y,i=y*s.size+x;if(!known(x,y)||blocked.has(i))continue;
  const t=s.terrain[i];if(t===TERRAIN.bridge||t===TERRAIN.ford)continue;
  let crossing=false,bankX=0,bankY=0,bank=false;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!known(x+dx,y+dy))continue;
   const neighbor=s.terrain[(y+dy)*s.size+x+dx];
   if(neighbor===TERRAIN.bridge||neighbor===TERRAIN.ford)crossing=true;
   if(Math.abs(dx)+Math.abs(dy)!==1||bank)continue;
   if(t===TERRAIN.water?neighbor<TERRAIN.water:neighbor===TERRAIN.water){bank=true;bankX=dx;bankY=dy;}
  }
  if(crossing)continue;
  const h=hash(x,y);let kind:LandscapeKind;
  if(t===TERRAIN.water){if(!bank||h%3===0)continue;kind='lilies';}
  else if(bank){if(h%4===0)continue;kind='reeds';}
  else if(t===TERRAIN.woodland){if(h%3!==0)continue;kind='ferns';}
  else{if(t!==TERRAIN.grass||h%5!==0)continue;kind='flowers';}
  const px=x+.3+(h%401)/1000+(bank?bankX*.16:0),py=y+.3+((h>>>10)%401)/1000+(bank?bankY*.16:0);
  // Check the full small plant clump, not just its origin, against busy paths.
  let route=false;const width=s.size*4;
  if(settlement)for(let sy=Math.max(0,Math.floor((py-.24)*4));sy<=Math.min(width-1,Math.floor((py+.24)*4));sy++)for(let sx=Math.max(0,Math.floor((px-.24)*4));sx<=Math.min(width-1,Math.floor((px+.24)*4));sx++)if(settlement[sy*width+sx]>50)route=true;
  if(!route)result.push({kind,x:px,y:py,angle:(h%6283)/1000,scale:.75+((h>>>16)%451)/1000});
 }
 return result;
}

/** Opaque low-poly plants with baked vertex colors; no textures, billboards or
 * alpha sorting. Each complete clump is a single instanced draw item. */
function plantGeometry(kind:LandscapeKind):BufferGeometry{
 const parts:BufferGeometry[]=[];
 const add=(source:BufferGeometry,color:number)=>{
  const g=source.index?source.toNonIndexed():source;if(g!==source)source.dispose();g.deleteAttribute('uv');
  const c=new Color(color),colors:number[]=[];for(let i=0;i<g.getAttribute('position').count;i++)colors.push(c.r,c.g,c.b);
  g.setAttribute('color',new Float32BufferAttribute(colors,3));parts.push(g);
 };
 const triangle=(v:number[],color:number)=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,color);};
 if(kind==='reeds'){
  for(let j=0;j<6;j++){
   const a=j*2.4,r=.045+j%2*.018,x=Math.cos(a)*r,z=Math.sin(a)*r,height=.31+(j%3)*.095;
   triangle([x-.018,0,z,x+.018,0,z,x+Math.cos(a)*.10,height,z+Math.sin(a)*.10],j%2?0x768648:0x547847);
   if(j<3){add(new CylinderGeometry(.007,.011,height+.10,4).translate(x,(height+.10)/2,z),0x73834a);add(new CylinderGeometry(.018,.022,.085,5).translate(x,height+.07,z),0x69503a);}
  }
 }else if(kind==='lilies'){
  for(let j=0;j<3;j++){
   const a=j*2.4,cx=Math.cos(a)*.085,cz=Math.sin(a)*.085,r=.075+(j%2)*.025;
   for(let k=1;k<10;k++){const u=(k*.57)+a,v=((k+1)*.57)+a;triangle([cx,.002+j*.003,cz,cx+Math.cos(u)*r,.002+j*.003,cz+Math.sin(u)*r,cx+Math.cos(v)*r,.002+j*.003,cz+Math.sin(v)*r],j%2?0x5b7942:0x728747);}
  }
  add(new OctahedronGeometry(.022,0).scale(1,.55,1).translate(.015,.025,0),0xe4d4a5);
 }else if(kind==='flowers'){
  for(let j=0;j<4;j++){
   const a=j*2.4,x=Math.cos(a)*.10,z=Math.sin(a)*.10,h=.09+(j%3)*.025;
   add(new CylinderGeometry(.003,.005,h,3).translate(x,h/2,z),0x748347);
   for(let k=0;k<5;k++){const a=k*Math.PI*2/5;add(new OctahedronGeometry(.023,0).scale(1,.35,1).translate(x+Math.cos(a)*.019,h,z+Math.sin(a)*.019),j===3?0xa6b4c0:j===1?0xe6d38a:0xdcd8b1);}
   add(new OctahedronGeometry(.013,0).translate(x,h+.005,z),0xc4a447);
  }
 }else{
  for(let j=0;j<6;j++){
   const a=j*Math.PI/3,s=Math.sin(a),c=Math.cos(a);
   for(let k=0;k<5;k++){
    const t=(k+1)/6,r=t*.21,h=Math.sin(t*Math.PI*.7)*.18,w=(1-t)*.055;
    for(const side of [-1,1])triangle([c*(r-.035),h-.02,s*(r-.035),c*r-s*w*side,h,s*r+c*w*side,c*(r+.045),h+.012,s*(r+.045)],(j+k)%2?0x557644:0x769052);
   }
  }
 }
 const merged=mergeGeometries(parts,false)!;for(const p of parts)p.dispose();merged.computeBoundingSphere();return merged;
}

export class LandscapeDetails {
 private batches:Record<LandscapeKind,InstancedMesh>;private transform=new Object3D();private stamp='';private disposed=false;
 private fog?:number[];private terrain?:number[];private settlement?:Uint8Array;private entities?:Snapshot['entities'];
 constructor(private scene:Scene,private limit=480){
  this.limit=capacity(limit);this.batches={} as Record<LandscapeKind,InstancedMesh>;
  for(const kind of kinds){const m=new InstancedMesh(plantGeometry(kind),new MeshStandardMaterial({vertexColors:true,roughness:1,side:DoubleSide}),Math.max(1,this.limit));m.name=`Landscape ${kind}`;m.count=0;m.frustumCulled=false;m.receiveShadow=true;this.batches[kind]=m;scene.add(m);}
 }
 update(s:Snapshot,focus:Position,settlement?:Uint8Array):void{
  if(this.disposed)return;
  // The bounded content key also catches in-place visibility loss while paused.
  // Hidden terrain is deliberately omitted, including the neighbor halo.
  let content=2166136261;const mix=(n:number)=>{content=Math.imul(content^n,16777619);},cx=Math.floor(focus.x),cy=Math.floor(focus.y),width=s.size*4;
  for(let y=Math.max(0,cy-radius-1);y<=Math.min(s.size-1,cy+radius+1);y++)for(let x=Math.max(0,cx-radius-1);x<=Math.min(s.size-1,cx+radius+1);x++){
   const i=y*s.size+x,f=s.fog[i];mix(f);if(f!==2)continue;mix(s.terrain[i]);
   if(settlement)for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)mix(settlement[(y*4+dy)*width+x*4+dx]);
  }
  for(const e of s.entities)if((e.kind==='building'||e.kind==='resource'&&e.type==='wood')&&e.hp>0&&!e.ghost&&Math.abs(e.x-focus.x)<=radius+6&&Math.abs(e.y-focus.y)<=radius+6){mix(e.id);mix(e.x*1000);mix(e.y*1000);mix(e.kind==='building'?BUILDINGS[e.type as keyof typeof BUILDINGS]?.size??0:0);}
  const stamp=`${cx}:${cy}:${s.size}:${content}`;
  if(stamp===this.stamp&&s.fog===this.fog&&s.terrain===this.terrain&&settlement===this.settlement&&s.entities===this.entities)return;
  this.stamp=stamp;this.fog=s.fog;this.terrain=s.terrain;this.settlement=settlement;this.entities=s.entities;
  for(const kind of kinds)this.batches[kind].count=0;
  for(const p of planLandscapeDetails(s,focus,settlement,this.limit)){
   const mesh=this.batches[p.kind];this.transform.position.set(p.x,p.kind==='lilies'?.006:.008,p.y);this.transform.rotation.set(0,p.angle,0);this.transform.scale.setScalar(p.scale);this.transform.updateMatrix();mesh.setMatrixAt(mesh.count++,this.transform.matrix);
  }
  for(const kind of kinds)this.batches[kind].instanceMatrix.needsUpdate=true;
 }
 metrics(){const {reeds,lilies,flowers,ferns}=this.batches;return {reeds:reeds.count,lilies:lilies.count,flowers:flowers.count,ferns:ferns.count,total:reeds.count+lilies.count+flowers.count+ferns.count,limit:this.limit};}
 dispose():void{if(this.disposed)return;this.disposed=true;for(const kind of kinds){const m=this.batches[kind];this.scene.remove(m);m.geometry.dispose();(m.material as MeshStandardMaterial).dispose();m.dispose();m.count=0;}this.fog=this.terrain=undefined;this.entities=undefined;this.settlement=undefined;}
}
