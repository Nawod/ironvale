import {BUILDINGS,UNITS} from '../sim/definitions';
import type {Entity,FactionId,UnitType} from '../sim/types';
import {FACTIONS,validFaction} from '../sim/factions';

const NATURE=['wood','gold','stone','berries','deer','cow','alpaca','fox','food'];
const clamp=(n:number,max:number,min=0)=>Math.min(max,Math.max(min,Number.isFinite(n)?Math.floor(n):min));
export const LANKA_PORTRAIT_UNITS=['spearman','swordsman','archer','pikeman','champion','musketeer','rifleman','warElephant','cannon','danduMonara'] as const satisfies readonly UnitType[];
const DEFAULT_NATIVE_FACTION:Partial<Record<UnitType,FactionId>>={champion:'anuradhapura',musketeer:'kandy',rifleman:'british',warElephant:'anuradhapura',cannon:'dutch',danduMonara:'ravana'};
export interface PortraitRecord {type:Entity['type'];owner:number;age:number;wallTier?:3;faction?:FactionId;url:string}
/** New troops have no older artwork; a regional default also covers callers
 * that have no player context. Existing non-faction portrait URLs stay stable. */
export function portraitFaction(type:Entity['type'],faction?:FactionId):FactionId|undefined{return validFaction(faction)?faction:DEFAULT_NATIVE_FACTION[type as UnitType];}
export function commandPortrait(type:Entity['type'],owner=0,age=1,wallTier?:3,faction?:FactionId):string|undefined{
 const city=clamp(owner,7),era=clamp(age,3,1);
 const nativeFaction=portraitFaction(type,faction);
 if(nativeFaction&&(type==='capital'||LANKA_PORTRAIT_UNITS.includes(type as typeof LANKA_PORTRAIT_UNITS[number])))return`./art/portraits/lanka-${nativeFaction}-${type}-${city}-age${type==='capital'?era:1}.webp`;
 if(Object.hasOwn(BUILDINGS,type))return`./art/portraits/${type}-${city}-${type==='wall'&&wallTier===3?'reinforced':`age${['palisade','wall','gate'].includes(type)?1:era}`}.webp`;
 if(Object.hasOwn(UNITS,type))return`./art/portraits/${type}-${type==='zombie'?0:city}.webp`;
 if(NATURE.includes(type))return`./art/portraits/${type}.webp`;
 return undefined;
}
export function portraitCatalog():PortraitRecord[]{
 const records=new Map<string,PortraitRecord>();
 const add=(type:Entity['type'],owner:number,age:number,wallTier?:3)=>{const url=commandPortrait(type,owner,age,wallTier)!;records.set(url,{type,owner,age,wallTier,faction:portraitFaction(type),url});};
 for(let owner=0;owner<8;owner++){
  for(const type of Object.keys(BUILDINGS) as Entity['type'][])for(const age of [1,2,3])add(type,owner,age);
  add('wall',owner,3,3);
  for(const type of Object.keys(UNITS) as Entity['type'][])add(type,owner,1);
 }
 for(const type of NATURE as Entity['type'][])add(type,0,1);
 return [...records.values()];
}

/** Explicit separate batch: 10 factions × 8 city colors × (10 troops + 3 capitals). */
export function lankaPortraitCatalog():PortraitRecord[]{
 const records:PortraitRecord[]=[];
 for(const faction of Object.keys(FACTIONS) as FactionId[])for(let owner=0;owner<8;owner++){
  for(const type of LANKA_PORTRAIT_UNITS)records.push({type,owner,age:1,faction,url:commandPortrait(type,owner,1,undefined,faction)!});
  for(const age of [1,2,3])records.push({type:'capital',owner,age,faction,url:commandPortrait('capital',owner,age,undefined,faction)!});
 }
 return records;
}
