import {UNITS} from '../sim/definitions';
import type {Entity,UnitType} from '../sim/types';
export interface SelectionGroup {type:UnitType;ids:number[];count:number;hp:number;maxHp:number}
export function selectionGroups(selected:readonly Entity[],playerId:number):SelectionGroup[]{
 const groups=new Map<UnitType,SelectionGroup>(),seen=new Set<number>();
 for(const e of selected){
  if(e.owner!==playerId||e.kind!=='unit'||e.hp<=0||e.ghost||e.garrisoned!==undefined||seen.has(e.id)||!Object.hasOwn(UNITS,e.type))continue;
  seen.add(e.id);const type=e.type as UnitType,group=groups.get(type)??{type,ids:[],count:0,hp:0,maxHp:0};group.ids.push(e.id);group.count++;group.hp+=e.hp;group.maxHp+=e.maxHp;groups.set(type,group);
 }
 return(Object.keys(UNITS) as UnitType[]).flatMap(type=>groups.has(type)?[groups.get(type)!]:[]);
}
