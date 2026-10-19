import { BUILDINGS } from '../sim/definitions';
import type { Entity, BuildingType } from '../sim/types';
import type { ModelPart } from './models3d';
import { detailBuilder, LankaGeometry, LANKA_FACTIONS, type LankaFaction, type Detail } from './lanka-geometry3d';

/** Original city adornments layered over the approved functional buildings.
 * Walls/gates keep their connected geometry and moving passages untouched.
 * Lankan, Dravidian, colonial and legendary forms are artistic interpretations. */
export class LankaArchitecture {
 private bank=new LankaGeometry();
 private disposed=false;
 get(e:Entity,factionId:string|undefined,age=1):ModelPart[]|undefined {
  if(this.disposed||e.kind!=='building'||e.hp<=0||!LANKA_FACTIONS.includes(factionId as LankaFaction)||!Object.hasOwn(BUILDINGS,e.type)||['wall','palisade','gate'].includes(e.type))return;
  const era=Math.max(1,Math.min(3,Math.floor(Number.isFinite(age)?age:1)));
  return this.bank.get(`${e.type}:${factionId}:${era}`,e.owner,()=>this.build(e.type as BuildingType,factionId as LankaFaction,era));
 }
 metrics(){return this.bank.metrics();}
 dispose(){if(this.disposed)return;this.disposed=true;this.bank.dispose();}
 private build(type:BuildingType,faction:LankaFaction,age:number):Detail[]{
  const {parts,add,box,beam}=detailBuilder(),n=BUILDINGS[type].size;
  if(type==='farm'){
   // Low water channels and a city-colored boundary marker remain outside crops.
   for(const x of [-n*.47,n*.47])box('stone',x,.12,0,.08,.17,n*.97);
   box('team',n*.44,.34,-n*.44,.12,.3,.12);return parts;
  }
  const major=type==='capital'||type==='fortress',tower=type==='tower';
  const y=type==='fortress'?4.55:type==='capital'?2.75:tower?3.4:type==='house'?1.9:2.15;
  const w=major?1.7:Math.min(n*.65,1.6),z=type==='fortress'?-.4:type==='capital'?-.48:0;
  // Owner-color cloth is a narrow, readable strip; stone and roof colors retain
  // their authored identities in allied, enemy and multiplayer cities alike.
  box('team',0,y-.15,z+w*.51,w*.64,.17,.05);
  if(['portuguese','dutch','british'].includes(faction)){
   const pale=faction==='portuguese'?'ivory':'stone';
   // Classical colonnade sits at the sides, never across an existing doorway.
   for(const sign of [-1,1]){
    const x=sign*n*.4;add('cylinder','ivory',[x,.91,n*.25],[.13,1.45,.13]);box('ivory',x,1.65,n*.25,.24,.12,.24);
   }
   if(faction==='portuguese'){
    // Warm plaster and a curved bell gable distinguish the early coastal forts.
    box('ivory',0,y+.14,z,w*.78,.55,.13);add('sphere','ivory',[0,y+.45,z],[w*.78,.48,.14]);
    add('sphere','dark',[0,y+.26,z+.075],[.22,.3,.04]);add('cylinder','gold',[0,y+.22,z+.12],[.14,.17,.14]);box('gold',0,y+.72,z,.05,.2,.05);
   }else if(faction==='dutch'){
    // A stepped gable and orange terracotta caps.
    for(let step=0;step<4;step++){const width=w*(1-step*.21);box(pale,0,y+step*.2,z,width,.23,.15);box('tile',0,y+step*.2+.13,z,width+.06,.05,.19);}
   }else{
    // Pediment, metopes and a compact clock turret for later colonial towns.
    for(const sign of [-1,1])box('ivory',sign*w*.24,y+.17,z,w*.57,.12,.2,[0,0,-sign*.43]);
    box('ivory',0,y+.37,z,.4,.62,.33);add('cylinder','cloth',[0,y+.43,z+.18],[.26,.025,.26],[Math.PI/2,0,0]);beam('dark',[0,y+.43,z+.2],[0,y+.51,z+.2],.018);beam('dark',[0,y+.43,z+.2],[.07,y+.43,z+.2],.018);add('cone','dark',[0,y+.81,z],[.56,.32,.56]);
   }
  }else if(['chola','elara','jaffna'].includes(faction)){
   // Tiered gopuram-like roof crown with repeated niches and horizontal cornices.
   const levels=faction==='chola'?5:faction==='jaffna'?4:3;
   for(let level=0;level<levels;level++){
    const width=w*(1-level*.13),yy=y+level*.24;
    box(faction==='elara'?'stone':'ivory',0,yy,z,width,.23,width*.56);box('gold',0,yy+.13,z,width+.14,.055,width*.56+.13);
    for(const sign of [-1,1]){box('dark',sign*width*.28,yy,z+width*.29,.08,.13,.025);add('sphere','stone',[sign*width*.28,yy,z+width*.31],[.07,.09,.05]);}
   }
   for(let i=-1;i<=1;i++)add('sphere','gold',[i*.2,y+levels*.24+.03,z],[.13,.18,.13]);
  }else if(faction==='ravana'){
   // A clearly fantastical winged citadel crown, dark stone and gold spires.
   box('dark',0,y+.13,z,w,.28,w*.72);
   for(const sign of [-1,1]){
    add('wing','gold',[sign*w*.32,y+.25,z],[sign*w*.7,.8,w*.7],[0,0,sign*.18]);
    add('cone','gold',[sign*w*.4,y+.72,z],[.27,1.1,.27]);add('sphere','team',[sign*w*.4,y+.95,z],[.16,.19,.16]);
   }
   add('cone','gold',[0,y+1,z],[.48,1.4,.48]);
  }else if(faction==='kandy'){
   // Broad, stacked hipped tile roofs and carved timber finials.
   for(let tier=0;tier<(major?3:2);tier++){
    const width=w*(1-tier*.19),yy=y+tier*.31;
    for(const sign of [-1,1])box('tile',sign*width*.24,yy,z,width*.58,.11,width*.78,[0,0,-sign*.3]);
    box('wood',0,yy+.1,z,.075,.12,width*.83);
   }
   for(const sign of [-1,1])add('cone','gold',[0,y+(major?.9:.58),z+sign*w*.36],[.13,.37,.13]);
  }else{
   // Bell-shaped dagoba crowns differ between ancient whitewashed Anuradhapura
   // and the masonry/terracotta forms used for the Polonnaruwa interpretation.
   const ancient=faction==='anuradhapura',paint=ancient?'ivory':'stone';
   const domeWidth=w*(ancient?.65:.58),height=ancient?.62:.78;
   add('cylinder',paint,[0,y+.08,z],[domeWidth*1.16,.13,domeWidth*1.16]);
   add('sphere',paint,[0,y+.2,z],[domeWidth,height,domeWidth]);box(paint,0,y+height*.59,z,.23,.18,.23);
   for(let i=0;i<4;i++)add('cylinder','gold',[0,y+height*.72+i*.085,z],[.22-i*.045,.045,.22-i*.045]);
   add('cone','gold',[0,y+height*.72+.43,z],[.075,.27,.075]);
   if(!ancient){for(const sign of [-1,1])box('tile',sign*w*.49,y+.04,z,.12,.12,w*.8);}
  }
  // Corner lotus-like capitals and shallow approach steps give common regional
  // continuity while preserving existing footprints, selection and collisions.
  if(major&&age>=2)for(const sign of [-1,1]){
   add('cylinder','stone',[sign*n*.41,.21,n*.36],[.34,.15,.34]);
   add('sphere',faction==='ravana'?'gold':'ivory',[sign*n*.41,.36,n*.36],[.29,.26,.29]);
  }
  return parts;
 }
}
