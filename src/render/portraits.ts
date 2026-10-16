import {BUILDINGS,UNITS} from '../sim/definitions';
import type {Entity} from '../sim/types';

const NATURE=['wood','gold','stone','berries','deer','cow','alpaca','fox','food'];
const clamp=(n:number,max:number,min=0)=>Math.min(max,Math.max(min,Number.isFinite(n)?Math.floor(n):min));
export function commandPortrait(type:Entity['type'],owner=0,age=1,wallTier?:3):string|undefined{
 const city=clamp(owner,7),era=clamp(age,3,1);
 if(Object.hasOwn(BUILDINGS,type))return`./art/portraits/${type}-${city}-${type==='wall'&&wallTier===3?'reinforced':`age${['palisade','wall','gate'].includes(type)?1:era}`}.webp`;
 if(Object.hasOwn(UNITS,type))return`./art/portraits/${type}-${type==='zombie'?0:city}.webp`;
 if(NATURE.includes(type))return`./art/portraits/${type}.webp`;
 return undefined;
}
export function portraitCatalog():{type:Entity['type'];owner:number;age:number;wallTier?:3;url:string}[]{
 const records=new Map<string,{type:Entity['type'];owner:number;age:number;wallTier?:3;url:string}>();
 const add=(type:Entity['type'],owner:number,age:number,wallTier?:3)=>{const url=commandPortrait(type,owner,age,wallTier)!;records.set(url,{type,owner,age,wallTier,url});};
 for(let owner=0;owner<8;owner++){
  for(const type of Object.keys(BUILDINGS) as Entity['type'][])for(const age of [1,2,3])add(type,owner,age);
  add('wall',owner,3,3);
  for(const type of Object.keys(UNITS) as Entity['type'][])add(type,owner,1);
 }
 for(const type of NATURE as Entity['type'][])add(type,0,1);
 return [...records.values()];
}
