import { TextureLoader } from 'three';
import type { Entity } from '../sim/types';
import { COLORS } from '../sim/definitions';
import { HistoricalModels } from './historical-models3d';
import type { ImportedPoseOptions } from './imported-models3d';
import type { ModelPart } from './models3d';
import { detailBuilder, LankaGeometry, LANKA_FACTIONS, type LankaFaction, type Detail, type Paint } from './lanka-geometry3d';

type Action='idle'|'walk'|'work'|'attack';
const TYPES=['spearman','swordsman','archer','pikeman','champion','musketeer','rifleman','warElephant','cannon','danduMonara'] as const;
const actions:Action[]=['idle','walk','work','attack'];
const rewrite=(url:string)=>url.replace('/historical/','/lanka/');
type JsonLoader=NonNullable<ConstructorParameters<typeof HistoricalModels>[0]>;
type ByteLoader=NonNullable<ConstructorParameters<typeof HistoricalModels>[1]>;
type ImageLoader=NonNullable<ConstructorParameters<typeof HistoricalModels>[2]>;

/** Regional game interpretation with native sampled tunics/faces/elephant art and
 * original equipment. All finite faction/owner/pose combinations prepare at load;
 * per-frame lookup allocates no rigs, meshes, materials or ModelPart arrays. */
export class LankaModels {
 status:'idle'|'loading'|'ready'|'failed'|'disposed'='idle';
 error?:string;
 private native:HistoricalModels;
 private original=new LankaGeometry();
 private frames=new Map<string,ModelPart[]>();
 private cycles:Record<string,Record<Action,{duration:number;frames:unknown[]}>>={};
 private pending?:Promise<void>;
 constructor(json?:JsonLoader,bytes?:ByteLoader,image?:ImageLoader){
  const loadJson:JsonLoader=async url=>{
   const path=rewrite(url);
   let bank:Awaited<ReturnType<JsonLoader>>;
   if(json)bank=await json(path);
   else {const response=await fetch(path);if(!response.ok)throw new Error(`${path}: ${response.status}`);bank=await response.json();}
   if(this.status!=='disposed')for(const [type,outfit] of Object.entries(bank.sets))this.cycles[type]=outfit.cycles;
   return bank;
  };
  const loadBytes:ByteLoader=async url=>{
   const path=rewrite(url);if(bytes)return bytes(path);
   const response=await fetch(path);if(!response.ok)throw new Error(`${path}: ${response.status}`);return response.arrayBuffer();
  };
  this.native=new HistoricalModels(loadJson,loadBytes,url=>image?image(rewrite(url)):new TextureLoader().loadAsync(rewrite(url)));
 }
 load(){if(this.pending)return this.pending;if(this.status==='disposed')return Promise.resolve();this.status='loading';this.pending=this.prepare();return this.pending;}
 private async prepare(){
  await this.native.load();if((this.status as string)==='disposed')return;
  if(this.native.status!=='ready'){this.status='failed';this.error=this.native.error;return;}
  for(const faction of LANKA_FACTIONS)for(const type of TYPES)for(let owner=0;owner<COLORS.length;owner++)for(let variant=0;variant<3;variant++){
   const source=this.source(type),e={kind:'unit',type:source,id:variant,owner} as Entity;
   const scale=type==='champion'?(faction==='ravana'?1.85:1.12):1;
   const equipment=this.original.get(`${faction}:${type}:${variant}`,owner,()=>this.equipment(faction,type,variant));
   const overlay=scale===1?equipment:equipment.map(p=>({...p,scale:[scale,scale,scale] as [number,number,number]}));
   for(const action of actions)for(let phase=0;phase<8;phase++){
    const duration=this.cycles[source]?.[action]?.duration??1;
    let parts:ModelPart[]=[];
    if(type!=='cannon'&&type!=='danduMonara'){
     const pose={time:duration*(phase+.01)/8-variant*.073,moving:action==='walk',working:action==='work',attacking:action==='attack'};
     const native=this.native.get(e,pose)??[];
     parts=(type==='musketeer'||type==='rifleman'?native.filter(p=>['body','head'].includes(p.material.userData.historicalRole)):native);
     if(scale!==1)parts=parts.map(p=>({...p,scale:[scale,scale,scale]}));
    }
    this.frames.set(this.key(faction,type,owner,variant,action,phase),parts.length?[...parts,...overlay]:overlay);
   }
  }
  this.status='ready';
 }
 private source(type:string){return type==='champion'?'swordsman':type==='musketeer'||type==='rifleman'?'archer':type;}
 private key(faction:string,type:string,owner:number,variant:number,action:Action,phase:number){return `${faction}:${type}:${owner}:${variant}:${action}:${phase}`;}
 get(e:Entity,factionId:string|undefined,pose:ImportedPoseOptions):ModelPart[]|undefined {
  if(this.status!=='ready'||e.kind!=='unit'||!LANKA_FACTIONS.includes(factionId as LankaFaction)||!TYPES.includes(e.type as typeof TYPES[number]))return;
  const variant=((e.id%3)+3)%3,owner=Math.max(0,Math.floor(Number.isFinite(e.owner)?e.owner:0))%COLORS.length;
  const action:Action=pose.attacking?'attack':pose.working?'work':pose.moving?'walk':'idle';
  const duration=this.cycles[this.source(e.type)]?.[action]?.duration??1,time=Number.isFinite(pose.time)?pose.time:0;
  const phase=((time+variant*.073)%duration+duration)%duration/duration,steps=pose.detail==='crowd'?2:8;
  return this.frames.get(this.key(factionId!,e.type,owner,variant,action,Math.floor(phase*steps)*(8/steps)));
 }
 metrics(){const n=this.native.metrics(),o=this.original.metrics();return {status:this.status,geometries:n.geometries+o.geometries,geometryBytes:n.geometryBytes+o.geometryBytes,triangles:n.triangles+o.triangles,materials:n.materials+o.materials,textures:n.textures,cachedFrames:this.frames.size,liveMixers:0};}
 dispose(){if(this.status==='disposed')return;this.status='disposed';this.frames.clear();this.cycles={};this.native.dispose();this.original.dispose();}

 private equipment(faction:LankaFaction,type:string,variant:number):Detail[]{
  const {parts,add,box,beam}=detailBuilder();
  const colonial=['portuguese','dutch','british'].includes(faction),legend=faction==='ravana',tamil=['chola','elara','jaffna'].includes(faction);
  if(type==='cannon'){
   // Two open, spoked wheels, axle, cheek carriage and hollow-looking muzzle.
   for(const x of [-.62,.62]){
    add('ring','wood',[x,.48,0],[.86,.86,.86],[0,Math.PI/2,0]);add('cylinder','iron',[x,.48,0],[.18,.16,.18],[0,0,Math.PI/2]);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;beam('wood',[x,.48,0],[x,.48+Math.sin(a)*.4,Math.cos(a)*.4],.055);}
   }
   beam('iron',[-.68,.48,0],[.68,.48,0],.12);
   for(const x of [-.3,.3])box('team',x,.48,-.32,.16,.25,1.35,[-.16,0,0]);
   add('cylinder','barrel',[0,.79,.3],[.31,1.7,.31],[Math.PI/2-.12,0,0]);
   add('ring','gold',[0,.88,1.13],[.32,.32,.32]);add('cylinder','dark',[0,.88,1.145],[.23,.015,.23],[Math.PI/2,0,0]);
   add('sphere','gold',[0,.68,-.62],[.21,.19,.21]);box('wood',0,.16,-1,.4,.16,.43);return parts;
  }
  if(type==='danduMonara'){
   // Original peacock-inspired winged craft: broad feather wings, prow, fan tail,
   // canopy and passenger deck. No claim that this is an archaeological object.
   add('sphere','wood',[0,.3,0],[1.05,.56,2.65]);box('team',0,.48,-.12,.78,.12,1.8);
   for(const sign of [-1,1]){
    add('wing','gold',[sign*.35,.42,-.22],[sign*2.45,1,1.65],[0,sign*.08,sign*.035]);
    for(let i=0;i<6;i++){
     const x=sign*(.68+i*.31),z=.25-i*.12;
     add('sphere',i%2?'green':'blue',[x,.48,z],[.3,.09,1.1-i*.055],[0,sign*.25,0]);add('sphere','gold',[x,.54,z+.35],[.12,.025,.2]);
    }
    beam('gold',[sign*.36,.53,-.6],[sign*.36,1.25,-.6],.065);beam('gold',[sign*.36,.53,.55],[sign*.36,1.25,.55],.065);
    beam('wood',[sign*.38,-.05,-.75],[sign*.38,-.05,.8],.09);
   }
   add('cone','gold',[0,1.4,-.03],[1.2,.48,1.6]);add('cone','team',[0,1.43,-.03],[1.02,.39,1.4]);
   beam('gold',[0,.4,1],[0,1.05,1.25],.22);add('sphere','blue',[0,1.12,1.28],[.4,.4,.48]);add('cone','gold',[0,1.12,1.62],[.18,.4,.18],[Math.PI/2,0,0]);
   for(const x of [-.12,.12])add('sphere','dark',[x,1.2,1.44],[.065,.065,.05]);
   for(let i=-2;i<=2;i++){add('sphere','green',[i*.25,.75,-1.13],[.24,.9,.1],[0,0,-i*.3]);add('sphere','gold',[i*.31,1.02,-1.08],[.12,.19,.04]);}
   return parts;
  }
  if(type==='warElephant'){
   box('team',0,2.43,-.05,1.35,.12,1.35);for(const x of [-.67,.67]){box('team',x,2.02,-.05,.06,.76,1.25);box('gold',x,1.67,-.05,.075,.055,1.3);}
   box('wood',0,2.61,-.07,.95,.2,1.02);for(const x of [-.45,.45])for(const z of [-.51,.4])beam('gold',[x,2.65,z],[x,3.05,z],.065);
   for(const z of [-.51,.4])box('gold',0,3.02,z,1,.07,.065);
   // Low seated mahout, not a floating infantry figure.
   add('sphere','skin',[0,2.95,.68],[.22,.27,.22]);box('cloth',0,2.7,.64,.3,.3,.22);add('ring','team',[0,3.03,.68],[.24,.24,.24],[Math.PI/2,0,0]);
   return parts;
  }
  // Regional wrap, sash, belts and headwear sit above native tunic/skin art.
  add('ring','team',[0,1.03,0],[.46,.46,.46],[Math.PI/2,0,0]);
  if(colonial){
   const uniform:Paint=faction==='british'?'red':faction==='dutch'?'blue':'ivory';
   box(uniform,0,1.34,-.05,.45,.46,.23);box('cloth',0,1.35,.08,.36,.07,.035,[0,0,.63]);box('cloth',0,1.35,.085,.36,.07,.035,[0,0,-.63]);
   if(faction==='british'){add('cylinder','dark',[0,2.02,-.05],[.32,.34,.32]);box('gold',0,2.04,.12,.12,.15,.025);add('cone','red',[.11,2.27,-.05],[.09,.24,.09]);}
   else {add('cylinder','dark',[0,1.95,-.05],[.48,.055,.48]);add('cone','dark',[0,2.02,-.05],[.3,.19,.3]);if(faction==='dutch')box('gold',0,1.98,.14,.14,.055,.045);}
  } else if(legend){
   add('cylinder','gold',[0,1.97,-.05],[.36,.13,.36]);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add('cone','gold',[Math.cos(a)*.14,2.12,-.05+Math.sin(a)*.14],[.11,.26,.11]);}
   box('gold',0,1.4,-.045,.49,.35,.28);box('team',0,1.22,-.21,.45,.5,.05);
  } else {
   const wrap:Paint=tamil?'gold':faction==='kandy'?'ivory':'team';
   add('cylinder',wrap,[0,1.94,-.05],[.32+variant*.015,faction==='kandy'?.2:.1,.32+variant*.015]);
   if(faction==='kandy'){add('sphere','ivory',[.06,2.04,-.05],[.25,.22,.25]);box('team',-.15,1.74,-.14,.09,.32,.045);}
   if(tamil){add('cone','gold',[0,2.05,-.05],[.29,faction==='chola'?.32:.2,.29]);}
   if(faction==='polonnaruwa')box('gold',0,1.4,.115,.32,.3,.045);
   if(faction==='anuradhapura')box('cloth',0,1.37,.1,.45,.09,.045,[0,0,-.55]);
  }
  if(type==='champion'){
   for(const x of [-.3,.3])add('sphere','gold',[x,1.53,-.04],[.28,.2,.3]);box('team',0,1.21,-.2,.49,.65,.05);
  }
  if(type==='musketeer'||type==='rifleman'){
   // Both firearms have an actual wooden stock, metal lock, long round barrel
   // and muzzle; riflemen additionally have a bayonet and ammunition pouch.
   const z=type==='rifleman'?.11:0;
   box('wood',.13,1.27,-.15+z,.1,.12,.65,[-.1,0,0]);
   add('cylinder','barrel',[.13,1.31,.52+z],[.055,1.15,.055],[Math.PI/2,0,0]);box('iron',.19,1.3,.08+z,.07,.08,.15);
   for(const zz of [.23,.63])add('ring','iron',[.13,1.31,zz+z],[.075,.075,.075]);
   if(type==='rifleman'){add('cone','iron',[.13,1.32,1.35],[.045,.49,.045],[Math.PI/2,0,0]);box('dark',-.25,1.04,.02,.2,.18,.16);}
  }
  return parts;
 }
}
