import {BoxGeometry,BufferGeometry,CylinderGeometry,SphereGeometry,ConeGeometry,TorusGeometry,Float32BufferAttribute,MeshStandardMaterial,Object3D} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BUILDINGS,COLORS} from '../sim/definitions';
import type {BuildingType,Entity} from '../sim/types';
import type {ModelPart} from './models3d';
import {SurfaceLibrary,type Surface} from './surfaces3d';

type Vec=[number,number,number];
type Palette='stone'|'trim'|'mortar'|'plaster'|'wood'|'timber'|'roof'|'slate'|'dark'|'glass'|'metal'|'brass'|'soil'|'leaf'|'wheat'|'red'|'cloth'|'team'|'fire';
interface Detail {shape:keyof MedievalBuildings['shapes'];color:Palette;p:Vec;s:Vec;r:Vec;motion?:ModelPart['motion']}
interface TemplatePart {geometry:BufferGeometry;color:Palette;position:Vec;scale:Vec;rotation:Vec;motion?:ModelPart['motion']}
const PALETTE:Record<Palette,[string,Surface?]>={stone:['#9b9b87','stone'],trim:['#c6c1a6','stone'],mortar:['#747765','stone'],plaster:['#e0cfaa','plaster'],wood:['#98704a','wood'],timber:['#513a2a','wood'],roof:['#a85d43','roof'],slate:['#586974','roof'],dark:['#252b29'],glass:['#6e8b83'],metal:['#505b59','metal'],brass:['#b49a5a','metal'],soil:['#634a32','earth'],leaf:['#52733d','leaf'],wheat:['#ceb773','leaf'],red:['#a14c35','leaf'],cloth:['#e1d5b5','cloth'],team:['#ffffff','cloth'],fire:['#ed9038']};
const finite=(n:number,fallback:number)=>Number.isFinite(n)?n:fallback;

/** Original architecture. Templates own their geometry; owner variants share it.
 * Only this finite type/age/tier/owner space is cached, never entity identity. */
export class MedievalBuildings {
 readonly shapes={box:new BoxGeometry(1,1,1),cylinder:new CylinderGeometry(.5,.5,1,12),sphere:new SphereGeometry(.5,10,7),crop:new SphereGeometry(.5,6,4),cone:new ConeGeometry(.5,1,12),ring:new TorusGeometry(.5,.07,5,16),roof:this.roofGeometry()};
 private surfaces=new SurfaceLibrary();
 private templates=new Map<string,TemplatePart[]>();
 private cache=new Map<string,ModelPart[]>();
 private materials=new Map<string,MeshStandardMaterial>();
 private geometry=new Set<BufferGeometry>();
 private daylight=1;
 private disposed=false;

 get(entity:Entity,age:number):ModelPart[]|undefined {
  if(this.disposed||entity.kind!=='building'||entity.hp<=0||!Object.hasOwn(BUILDINGS,entity.type))return undefined;
  const type=entity.type as BuildingType,era=Math.min(3,Math.max(1,Math.floor(finite(age,1)))),owner=Math.min(7,Math.max(0,Math.floor(finite(entity.owner,0))));
  const tier=type==='wall'&&entity.wallTier===3?3:0,templateKey=`${type}:${era}:${tier}`,key=`${templateKey}:${owner}`;
  const cached=this.cache.get(key);if(cached)return cached;
  let template=this.templates.get(templateKey);
  if(!template){template=this.compile(this.build(type,era,tier));this.templates.set(templateKey,template);}
  const result=template.map(part=>({...part,material:this.material(part.color,owner)}));
  this.cache.set(key,result);return result;
 }

 updateLighting(daylight:number):void {
  this.daylight=Math.min(1,Math.max(0,finite(daylight,1)));
  const glass=this.materials.get('glass');if(glass)glass.emissiveIntensity=(1-this.daylight)*.65;
 }

 dispose():void {
  if(this.disposed)return;this.disposed=true;
  for(const shape of Object.values(this.shapes))shape.dispose();
  for(const geometry of this.geometry)geometry.dispose();
  for(const material of this.materials.values())material.dispose();
  this.surfaces.dispose();this.templates.clear();this.cache.clear();this.materials.clear();this.geometry.clear();
 }

 private material(color:Palette,owner:number):MeshStandardMaterial {
  const key=color==='team'?`team:${owner}`:color,cached=this.materials.get(key);if(cached)return cached;
  const [hex,surface]=PALETTE[color],textures=surface?this.surfaces.get(surface):undefined;
  const material=new MeshStandardMaterial({name:`medieval:${key}`,color:color==='team'?COLORS[owner]:hex,map:textures?.map??null,bumpMap:textures?.bump??null,bumpScale:surface==='stone'?.035:surface==='roof'?.022:.013,roughness:surface==='metal'?.52:.9,metalness:surface==='metal'?.45:0});
  if(color==='glass'){material.emissive.setHex(0xf4bd71);material.emissiveIntensity=(1-this.daylight)*.65;material.roughness=.32;}
  if(color==='fire'){material.emissive.setHex(0xff631b);material.emissiveIntensity=.8;}
  this.materials.set(key,material);return material;
 }

 private roofGeometry():BufferGeometry {
  // Pitched roof with real gable end faces, UVs on both slopes and eave thickness.
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([-.5,0,-.5,.5,0,-.5,0,1,-.5,-.5,0,.5,.5,0,.5,0,1,.5],3));
  g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);
  g.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,.5,1,0,1,1,1,.5,0],2));
  const result=g.toNonIndexed();g.dispose();result.computeVertexNormals();return result;
 }

 private compile(details:Detail[]):TemplatePart[] {
  const groups=new Map<string,{color:Palette;motion?:ModelPart['motion'];details:Detail[]}>(),result:TemplatePart[]=[],transform=new Object3D();
  for(const detail of details){
   // Flags rotate around their own centers; gate pieces share a vertical lift.
   if(detail.motion&&detail.motion!=='gate'){result.push({geometry:this.shapes[detail.shape],color:detail.color,position:detail.p,scale:detail.s,rotation:detail.r,motion:detail.motion});continue;}
   const key=`${detail.color}:${detail.motion??'static'}`,group=groups.get(key)??{color:detail.color,motion:detail.motion,details:[]};group.details.push(detail);groups.set(key,group);
  }
  for(const {color,motion,details:group} of groups.values()){
   const copies=group.map(detail=>{transform.position.fromArray(detail.p);transform.rotation.set(...detail.r);transform.scale.fromArray(detail.s);transform.updateMatrix();const g=this.shapes[detail.shape].clone().applyMatrix4(transform.matrix);if(!g.index)return g;const expanded=g.toNonIndexed();g.dispose();return expanded;});
   const geometry=mergeGeometries(copies,false)!;for(const copy of copies)copy.dispose();
   geometry.computeBoundingBox();geometry.computeBoundingSphere();this.geometry.add(geometry);
   result.push({geometry,color,position:[0,0,0],scale:[1,1,1],rotation:[0,0,0],motion});
  }
  return result;
 }

 private build(type:BuildingType,age:number,tier:number):Detail[] {
  const parts:Detail[]=[],n=BUILDINGS[type].size,upper=age>=2,imperial=age===3;
  const add=(shape:Detail['shape'],color:Palette,p:Vec,s:Vec,r:Vec=[0,0,0],motion?:ModelPart['motion'])=>parts.push({shape,color,p,s,r,motion});
  const box=(c:Palette,x:number,y:number,z:number,w:number,h:number,d:number,r:Vec=[0,0,0],motion?:ModelPart['motion'])=>add('box',c,[x,y,z],[w,h,d],r,motion);
  const beam=(c:Palette,a:Vec,b:Vec,width=.07,depth=width)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);add('box',c,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[width,length,depth],[Math.atan2(dz,dy),0,-Math.atan2(dx,Math.hypot(dy,dz))]);};
  const post=(x:number,z:number,h:number,c:Palette='timber',y=.12)=>box(c,x,y+h/2,z,.075,h,.075);
  const flag=(x:number,z:number,y:number)=>{post(x,z,.85,'timber',y);add('sphere','brass',[x,y+.88,z],[.09,.09,.09]);box('team',x+.17,y+.62,z,.34,.28,.026,[0,0,0],'flag');};
  const foundation=(w=n*.96,d=n*.96)=>{box('mortar',0,.075,0,w,.15,d);box('stone',0,.155,0,w*.985,.08,d*.985);};
  const barrel=(x:number,z:number,y=.2,scale=.32)=>{add('cylinder','wood',[x,y+scale*.57,z],[scale,scale*1.15,scale]);for(const level of [.2,.85])add('cylinder','metal',[x,y+scale*level,z],[scale*1.025,.035,scale*1.025]);add('cylinder','timber',[x,y+scale*1.15,z],[scale*.92,.018,scale*.92]);};
  const crate=(x:number,z:number,w=.32)=>{box('wood',x,.2+w/2,z,w,w,w);for(const sign of [-1,1]){box('timber',x+sign*w*.4,.2+w/2,z+w*.51,.035,w,.025);box('timber',x,.2+w*(sign>0?.9:.1),z+w*.51,w,.035,.025);}beam('timber',[x-w*.4,.23,z+w*.53],[x+w*.4,.2+w*.9,z+w*.53],.035);};
  const window=(x:number,y:number,z:number,w=.3,h=.43,side=false)=>{
   // Side windows use a local quarter turn, preserving shutter relief on every facade.
   const local=(c:Palette,dx:number,dy:number,dz:number,ww:number,hh:number,dd:number)=>side?box(c,z+dz,y+dy,x+dx,dd,hh,ww):box(c,x+dx,y+dy,z+dz,ww,hh,dd);
   local('timber',0,0,0,w+.12,h+.13,.065);local('glass',0,0,.039,w,h,.025);
   local('trim',0,-h/2-.055,.035,w+.2,.075,.15);local('timber',0,0,.065,.033,h,.03);local('timber',0,0,.067,w,.035,.03);
   for(const sign of [-1,1]){local('wood',sign*(w*.7+.055),0,.03,w*.28,h+.02,.055);local('timber',sign*(w*.7+.055),-h*.25,.064,w*.28,.028,.018);}
  };
  const door=(x:number,z:number,w=.48,h=1.05,y=.2,arched=false)=>{
   box('dark',x,y+h/2,z,w+.13,h+.1,.055);box('wood',x,y+h/2,z+.035,w,h,.04);
   for(let i=1;i<5;i++)box('timber',x-w/2+i*w/5,y+h/2,z+.061,.014,h,.018);
   for(const dy of [.23,.72])box('metal',x,y+h*dy,z+.071,w*.86,.045,.028);
   for(const sign of [-1,1])box(upper?'trim':'timber',x+sign*(w/2+.07),y+h/2,z+.025,.1,h+.12,.13);
   box(upper?'trim':'timber',x,y+h+.035,z+.025,w+.24,.1,.13);
   if(arched){add('cylinder','dark',[x,y+h,z+.01],[w+.13,.08,w+.13],[Math.PI/2,0,0]);for(let i=0;i<7;i++){const angle=i*Math.PI/6;box('trim',x+Math.cos(angle)*(w/2+.08),y+h+Math.sin(angle)*(w/2+.08),z+.045,.16,.19,.16,[0,0,angle-Math.PI/2]);}}
   add('ring','brass',[x+w*.28,y+h*.48,z+.105],[.075,.075,.075]);box('trim',x,.2,z+.12,w+.25,.08,.3);
  };
  const roof=(x:number,z:number,y:number,w:number,d:number,h:number,color:Palette=imperial?'slate':'roof')=>{
   add('roof',color,[x,y,z],[w,h,d]);
   for(const sign of [-1,1]){
    box('timber',x+sign*w*.495,y-.015,z,.065,.09,d+.035);
    for(const end of [-1,1])beam('timber',[x+sign*w/2,y,z+end*d*.502],[x,y+h,z+end*d*.502],.075,.075);
   }
   // Slightly raised tile courses and ridge caps give readable roof relief at oblique views.
   const slope=Math.atan2(h,w/2),rows=Math.max(4,Math.round(h/.14));
   for(let row=1;row<rows;row++){const t=row/rows;for(const sign of [-1,1])box(color,x+sign*w*.5*(1-t),y+h*t+.008,z,.025,.023,d,[0,0,-sign*slope]);}
   add('cylinder',color,[x,y+h+.025,z],[.11,d+.055,.11],[Math.PI/2,0,0]);
  };
  const chimney=(x:number,z:number,base:number,h=.85)=>{
   box('stone',x,base+h/2,z,.26,h,.3);for(let i=0;i<4;i++)box('trim',x,base+i*h/4,z,.29,.04,.33);
   box('trim',x,base+h,z,.36,.1,.4);box('dark',x,base+h+.055,z,.23,.025,.27);
  };
  const hall=(x:number,z:number,w:number,d:number,h:number,roofHeight=.8,entrance=true)=>{
   const y=.2;box(upper?'stone':'mortar',x,.34,z,w,.29,d);box('plaster',x,y+h/2,z,w*.99,h,d*.99);
   for(const xx of [-1,1])for(const zz of [-1,1]){
    box('timber',x+xx*w*.49,y+h/2,z+zz*d*.49,.085,h,.085);
    if(upper)for(let row=0;row<3;row++)box('trim',x+xx*w*.49,.28+row*.2,z+zz*d*.49,.16,.13,.16);
   }
   for(const sign of [-1,1]){
    for(const yy of [.36,y+h*.6,y+h-.025])box('timber',x,yy,z+sign*d*.5,w+.035,.065,.07);
    for(let i=1;i<4;i++)box('timber',x-w/2+i*w/4,y+h/2,z+sign*d*.503,.055,h,.06);
    if(w>1.4)for(const xx of [-1,1])beam('timber',[x+xx*w*.46,y+h*.62,z+sign*d*.508],[x+xx*w*.27,y+h*.95,z+sign*d*.508],.052,.055);
    box('timber',x+sign*w*.5,y+h*.62,z,.06,.065,d);
   }
   if(entrance)door(x,z+d/2+.025,.4,h>.0?Math.min(1.13,h*.74):1.05);
   if(w>1.5)for(const sign of [-1,1])window(x+sign*w*.31,y+h*.68,z+d/2+.045,.24,.34);
   window(z,y+h*.67,x+w/2+.04,.28,.38,true);
   roof(x,z,y+h,w+.2,d+.24,roofHeight);
   if(imperial){box('team',x-w*.3,y+h*.7,z+d*.51,.16,.6,.023);box('brass',x-w*.3,y+h*.39,z+d*.525,.17,.04,.025);}
  };
  const crenellations=(x:number,z:number,w:number,d:number,y:number)=>{
   box('trim',x,y,z,w+.09,.14,d+.09);
   const nx=Math.max(2,Math.round(w/.31)),nz=Math.max(2,Math.round(d/.31));
   for(let i=0;i<nx;i++)for(const sign of [-1,1])box('trim',x-w/2+(i+.5)*w/nx,y+.22,z+sign*d*.47,w/nx*.56,.34,.17);
   for(let i=1;i<nz-1;i++)for(const sign of [-1,1])box('trim',x+sign*w*.47,y+.22,z-d/2+(i+.5)*d/nz,.17,.34,d/nz*.56);
  };
  const stoneTower=(x:number,z:number,w:number,h:number,cap=false)=>{
   box('stone',x,h/2+.16,z,w,h,w);box('mortar',x,.3,z,w+.12,.28,w+.12);
   for(const y of [.56,h*.52,h-.18])box('trim',x,y,z,w+.065,.1,w+.065);
   for(const xx of [-1,1])for(const zz of [-1,1])for(let i=0;i<Math.floor(h/.4);i++)box('trim',x+xx*w*.455,.28+i*.4,z+zz*w*.455,.13,.15,.13);
   for(const sign of [-1,1]){box('dark',x+sign*w*.22,h*.65,z+w*.505,.075,.5,.025);box('dark',x+w*.505,h*.65,z+sign*w*.22,.025,.5,.075);}
   box('dark',x,h+.11,z,w*.7,.035,w*.7);crenellations(x,z,w,w,h+.16);
   if(cap){add('cone',imperial?'slate':'roof',[x,h+.85,z],[w*1.23,1.05,w*1.23]);flag(x,z,h+1.37);}
  };

  if(type==='palisade'){
   box('soil',0,.04,0,1.02,.08,.54);
   for(let i=0;i<6;i++){const x=(i-2.5)/6;add('cylinder','wood',[x,.85,0],[.19,1.62,.19]);add('cone','wood',[x,1.77,0],[.19,.26,.19]);}
   for(const z of [-.11,.11])for(const y of [.5,1.2])box('timber',0,y,z,1.02,.12,.09);
  }else if(type==='wall'){
   const h=tier===3?2.15:1.65;box('mortar',0,.13,0,1.025,.26,.7);box('stone',0,h/2,0,1.025,h,tier===3?.63:.48);
   for(const y of [.36,h-.12])box('trim',0,y,0,1.03,.1,tier===3?.67:.55);
   box('dark',0,h+.04,0,1.025,.06,.38);crenellations(0,0,1.025,tier===3?.65:.52,h+.09);
   if(tier===3)for(const x of [-.4,.4])box('trim',x,.9,0,.16,1.8,.72);
  }else if(type==='gate'){
   foundation(2.08,1.2);
   for(const x of [-.77,.77])stoneTower(x,0,.5,2.05);
   box('stone',0,2.02,0,1.13,.45,.72);crenellations(0,0,1.12,.72,2.28);
   // Merge the real slats by material; no opaque static panel fills the passage.
   for(let i=0;i<7;i++)box('wood',(i-3)*.142,.91,.16,.125,1.54,.09,[0,0,0],'gate');
   for(const y of [.43,1.39])box('metal',0,y,.22,.95,.06,.04,[0,0,0],'gate');
   flag(.76,0,2.55);
  }else if(type==='farm'){
   box('soil',0,.065,0,2.93,.13,2.93);
   for(let row=0;row<7;row++){
    const x=(row-3)*.39;box('mortar',x,.105,0,.1,.045,2.78);box('soil',x+.13,.15,0,.2,.12,2.77);
    for(let plant=0;plant<7;plant++){const z=(plant-3)*.37;if(age===1){for(const sign of [-1,1])beam('wheat',[x+.13,.19,z],[x+.13+sign*.065,.51+(plant%2)*.04,z+.035],.025);add('cone','wheat',[x+.13,.57,z],[.075,.2,.075]);}
     else{add('crop','leaf',[x+.13,.26,z],[.24,.15,.24]);for(const sign of [-1,1])add('crop','leaf',[x+.13+sign*.065,.27,z],[.09,.12,.23],[0,sign*.5,sign*.5]);if(imperial)add('crop','red',[x+.13,.31,z],[.08,.07,.08]);}}
   }
   for(const x of [-1.44,1.44]){box('wood',x,.16,0,.045,.18,2.91);for(const z of [-1.4,0,1.4])post(x,z,.4);}
   barrel(1.25,-1.23,.12,.26);
  }else if(type==='tower'){
   foundation();stoneTower(0,0,1.24,upper?3.12:2.7,!imperial);door(0,.65,.45,.95,.2,true);if(imperial)flag(0,0,3.6);
  }else if(type==='fortress'){
   foundation();const h=3.25;box('stone',0,1.6,-.15,2.85,2.9,2.65);
   for(const x of [-1.4,1.4])for(const z of [-1.4,1.4])stoneTower(x,z,.76,h);
   box('stone',0,3.24,-.4,1.55,1.2,1.45);crenellations(0,-.4,1.55,1.45,3.87);
   roof(0,-.4,4.05,1.7,1.6,.65,'slate');flag(.12,-.4,4.75);
   for(const z of [-1.52,1.22]){crenellations(0,z,2.7,.23,3);box('trim',0,1.16,z,2.8,.12,.27);}
   door(0,1.21,.95,1.5,.2,true);box('trim',0,.13,1.55,1.36,.16,.64);
   for(const x of [-.96,.96]){box('team',x,2.15,1.195,.27,.86,.025);box('brass',x,2.63,1.21,.37,.07,.045);window(x,2.55,1.2,.18,.36);}
  }else if(type==='capital'){
   foundation();box('trim',0,.205,.72,2.52,.05,1.16);
   hall(-.23,-.48,2.06,1.45,1.72,.83);hall(-1,.59,.53,1.14,1.22,.55,false);
   stoneTower(.92,-.76,.66,2.68);roof(.92,-.76,2.96,.91,.93,.72);flag(.92,-.76,3.71);
   door(-.23,.27,.59,1.2,.2,true);
   for(const x of [-.84,.7]){post(x,1.04,1.52,'trim');box('trim',x,1.75,.83,.16,.16,.6);}
   roof(-.12,.88,1.78,1.96,.71,.35);
   box('team',-.12,1.43,1.25,.65,.26,.025);barrel(1.07,1.03,.22,.25);
   if(imperial){box('trim',-1.08,.26,1.31,.39,.12,.2);add('sphere','leaf',[-1.08,.52,1.31],[.37,.48,.28]);}
  }else if(type==='outpost'){
   foundation();hall(-.43,-.27,1.56,1.74,1.47,.85);stoneTower(.83,-.63,.6,2.15);roof(.83,-.63,2.4,.79,.84,.63);flag(.83,-.63,3.07);
   for(const x of [-1.2,1.23])for(const z of [.7,1.3])post(x,z,.72);
   for(const x of [-1.2,1.23])for(const y of [.48,.73])box('wood',x,y,1,.06,.07,.64);
   crate(.72,.81,.37);barrel(1.13,1.18,.2,.3);
  }else if(type==='house'){
   foundation();hall(-.06,-.09,1.46,1.4,upper?1.55:1.4,.78);chimney(.43,-.46,1.75,.93);
   roof(-.08,.74,1.3,.67,.48,.28);for(const x of [-.34,.19])post(x,.91,1.16);
   box('wood',-.73,.37,.81,.35,.31,.25);add('sphere','leaf',[-.73,.59,.81],[.36,.25,.3]);
   barrel(.7,.79,.2,.27);
  }else if(type==='storage'){
   foundation();hall(-.04,-.13,1.55,1.34,1.34,.94,false);door(-.04,.57,.83,1.08);chimney(.53,-.5,1.95,.57);
   barrel(-.65,.76,.2,.29);barrel(.68,.69,.2,.31);crate(.68,.22,.35);
   box('timber',-.04,1.66,.64,.65,.11,.22);add('ring','brass',[-.04,1.6,.8],[.14,.14,.14]);
  }else if(type==='market'){
   foundation();hall(0,-.78,2.24,.94,1.3,.68);
   for(const x of [-.76,.76]){
    box('wood',x,.62,.67,.92,.65,.58);for(const z of [.4,.97])for(const xx of [-.45,.45])post(x+xx,z,1.48);
    roof(x,.68,1.62,1.06,.94,.27,'cloth');
    for(let stripe=0;stripe<4;stripe++)box('team',x-.39+stripe*.26,1.6,1.15,.12,.23,.035);
    for(let i=0;i<4;i++)for(let j=0;j<2;j++)add('sphere',x<0?'red':'wheat',[x-.28+i*.18,.99,.54+j*.22],[.15,.15,.15]);
   }
   barrel(1.24,-.2,.2,.31);crate(-1.23,-.15,.31);flag(1.26,-1.12,1.95);
  }else if(type==='smithy'){
   foundation();hall(-.25,-.21,1.12,1.24,1.24,.77,false);chimney(.23,-.47,1.3,1.46);
   box('stone',.48,.59,-.12,.55,.8,.64);box('dark',.48,.52,.215,.34,.39,.035);box('fire',.48,.39,.24,.23,.09,.04);
   roof(.13,.61,1.47,1.63,.72,.3,'slate');for(const x of [-.63,.85])post(x,.88,1.31);
   box('wood',-.16,.44,.67,.29,.47,.27);box('metal',-.16,.73,.67,.48,.11,.19);box('metal',.1,.77,.67,.19,.065,.16,[0,0,.23]);
   barrel(-.72,.7,.2,.27);for(let i=0;i<3;i++)box('metal',.66,.24+i*.06,.68,.3,.035,.12);
  }else if(type==='barracks'){
   foundation();hall(-.22,-.48,2.13,1.52,1.55,.9);chimney(.44,-.85,1.95,.77);
   for(const x of [-.91,.94]){post(x,.89,1.7);box('team',x,1.46,.9,.3,.58,.03);box('brass',x,1.78,.9,.42,.065,.07);}
   for(let i=0;i<5;i++){post(-1.18+i*.15,1.25,1.13,'wood');add('cone','metal',[-1.18+i*.15,1.41,1.25],[.09,.2,.09]);}
   for(const y of [.43,.78])box('timber',-.88,y,1.22,.84,.08,.1);crate(.8,.95,.43);
   for(const x of [-.52,.1]){add('sphere','team',[x,.64,1.21],[.34,.47,.08]);box('brass',x,.64,1.26,.04,.29,.025);}
  }else if(type==='range'){
   foundation();hall(-.59,-.35,1.28,1.88,1.38,.78);box('soil',.73,.205,.18,1.04,.04,2.02);
   for(const z of [-.69,.14,.98]){
    const x=.77;beam('wood',[x-.28,.2,z-.12],[x,.95,z],.06);beam('wood',[x+.28,.2,z-.12],[x,.95,z],.06);
    for(const [radius,color] of [[.52,'wheat'],[.36,'red'],[.18,'cloth']] as const)add('cylinder',color,[x,1.02,z],[radius,.055,radius],[Math.PI/2,0,0]);
    beam('wood',[x-.07,1.02,z+.04],[x-.17,1.1,z+.37],.02);
   }
   flag(-.9,-.94,2.29);crate(-.53,.96,.34);
  }else if(type==='stable'){
   foundation();hall(0,-.69,2.37,1.1,1.44,.83,false);door(0,-.11,.7,1.16);
   roof(0,.48,1.44,2.61,1.21,.42);for(const x of [-1.12,0,1.12])post(x,1,1.3);
   for(const x of [-1.12,0,1.12]){box('wood',x,.56,.59,.07,.67,.92);for(const y of [.47,.76])box('timber',x*.5+(x>0?.5:-.5),y,1.03,.84,.07,.06);}
   // Hay bales and a water trough identify the open paddock without decorative horses.
   for(const x of [-.67,.68]){box('wheat',x,.46,.51,.59,.52,.63);for(const xx of [-.2,.2])box('wood',x+xx,.46,.51,.035,.54,.65);}
   box('wood',1.22,.38,-.2,.23,.36,.76);box('glass',1.22,.57,-.2,.17,.025,.65);flag(-1.05,-.9,2.38);
  }else if(type==='workshop'){
   foundation();hall(-.29,-.58,1.95,1.21,1.72,.95,false);door(-.29,.04,.91,1.39);chimney(.44,-.8,2.1,.87);
   roof(-.09,.63,1.67,2.37,1.05,.37);for(const x of [-1.16,1])post(x,1.04,1.5);
   box('wood',-.25,.67,.65,1.5,.14,.67);for(const x of [-.89,.39])for(const z of [.4,.88])post(x,z,.46);
   for(const x of [-1,.86])add('ring','timber',[x,.53,.64],[.69,.69,.69],[0,Math.PI/2,0]);
   for(const x of [-1,.86])for(const angle of [0,Math.PI/3,Math.PI*2/3])box('wood',x,.53,.64,.045,.62,.045,[angle,0,0]);
   for(let i=0;i<4;i++)box('wood',.85,.29+i*.075,-.05,.45,.06,1.15);box('metal',-.2,.79,.65,.55,.07,.13);flag(-1.02,-.88,2.85);
  }
  // Small cloth badges retain city identity even on early economic buildings.
  if(!parts.some(part=>part.color==='team')){
   const marker:Partial<Record<BuildingType,Vec>>={house:[-.5,1.12,.64],storage:[.49,1.1,.58],smithy:[-.58,1.1,.44],farm:[1.44,.48,1.16],wall:[0,1.22,tier===3?.38:.29],palisade:[0,1.12,.18]};
   const [x,y,z]=marker[type]??[0,1,n*.48];
   if(type==='farm')post(x,z,.62,'timber');
   box('team',x,y,z,.18,.26,.025);box('timber',x,y+.15,z,.24,.045,.04);
  }
  return parts;
 }
}
