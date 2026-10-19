import type {BuildingType,Entity,FactionId,Player,UnitType} from './types';
import {BUILDINGS,UNITS} from './definitions';
import type {BuildingDef,UnitDef} from './definitions';
export interface FactionDef {id:FactionId;name:string;era:string;category:'historical'|'legendary';summary:string;specialties:string[];architecture:'lankan'|'dravidian'|'colonial'|'legendary'}
export const FACTIONS:Record<FactionId,FactionDef>={
 anuradhapura:{id:'anuradhapura',name:'Anuradhapura',era:'Ancient kingdom',category:'historical',summary:'An ancient Lankan kingdom with elephant armies and an epic warrior tradition.',specialties:['War elephants: +10% health','Yodha: epic champions inspired by legend, not literal giants'],architecture:'lankan'},
 polonnaruwa:{id:'polonnaruwa',name:'Polonnaruwa',era:'Medieval kingdom',category:'historical',summary:'A kingdom of irrigation, farming and monumental stone construction.',specialties:['War elephants','Farms cost 20% less wood','Stone buildings construct 15% faster'],architecture:'lankan'},
 kandy:{id:'kandy',name:'Kandy',era:'Highland kingdom',category:'historical',summary:'A highland kingdom drawing on forest warfare, firearms and fortified defense.',specialties:['Musketeers and war elephants','Towers and fortresses: +15% health'],architecture:'lankan'},
 chola:{id:'chola',name:'Chola',era:'Medieval South Indian empire',category:'historical',summary:'An expansionist South Indian power with spear infantry and elephants.',specialties:['War elephants','Spearmen and pikemen: +15% attack'],architecture:'dravidian'},
 elara:{id:'elara',name:'Elara',era:'Ancient Anuradhapura reign',category:'historical',summary:'A faction inspired by the Tamil ruler of ancient Anuradhapura.',specialties:['War elephants','Spear and sword infantry: +1 armor'],architecture:'dravidian'},
 jaffna:{id:'jaffna',name:'Jaffna',era:'Medieval northern kingdom',category:'historical',summary:'A northern kingdom represented through archery, trade and elephant forces.',specialties:['War elephants','Archers and crossbowmen: +10% attack','Market exchanges return 75 per 100'],architecture:'dravidian'},
 portuguese:{id:'portuguese',name:'Portuguese',era:'Early colonial period',category:'historical',summary:'A colonial faction centered on firearms, cannon and coastal forts.',specialties:['Musketeers and cannon','Fortresses: +20% health'],architecture:'colonial'},
 dutch:{id:'dutch',name:'Dutch',era:'Dutch colonial period',category:'historical',summary:'A colonial trading power with firearm troops and artillery.',specialties:['Musketeers and cannon','Markets cost 20% less wood','Market exchanges return 80 per 100'],architecture:'colonial'},
 british:{id:'british',name:'British',era:'British colonial period',category:'historical',summary:'A later colonial faction with expensive ranged infantry and artillery.',specialties:['Musketeers, riflemen and cannon'],architecture:'colonial'},
 ravana:{id:'ravana',name:'Ravana',era:'Mythic Lanka',category:'legendary',summary:'A clearly legendary faction inspired by the Ramayana and later Lankan folklore.',specialties:['War elephants and champions','Dandu Monara: costly legendary flying craft; cannot occupy or garrison'],architecture:'legendary'},
};
type FactionPlayer=Pick<Player,'faction'>;
export function validFaction(value:unknown):value is FactionId{return typeof value==='string'&&Object.hasOwn(FACTIONS,value);}
export function factionFor(player?:FactionPlayer):FactionDef|undefined{return player?.faction?FACTIONS[player.faction]:undefined;}
const elephants=new Set<FactionId>(['anuradhapura','polonnaruwa','kandy','chola','elara','jaffna','ravana']);
const firearms=new Set<FactionId>(['kandy','portuguese','dutch','british']);
export function factionUnitTypes(player:FactionPlayer|undefined,building:BuildingType):UnitType[]{
 const types=[...(BUILDINGS[building].trains??[])],f=player?.faction;if(!f)return types;
 if(building==='stable'&&elephants.has(f))types.push('warElephant');
 if(building==='barracks'&&(f==='anuradhapura'||f==='ravana'))types.push('champion');
 if(building==='range'&&firearms.has(f))types.push('musketeer');
 if(building==='range'&&f==='british')types.push('rifleman');
 if(building==='workshop'&&['portuguese','dutch','british'].includes(f))types.push('cannon');
 if(building==='workshop'&&f==='ravana')types.push('danduMonara');
 return types;
}
export function unitName(type:UnitType,player?:FactionPlayer):string{return type==='champion'?(player?.faction==='anuradhapura'?'Yodha champion':player?.faction==='ravana'?'Rakshasa giant':UNITS[type].name):UNITS[type].name;}
/** Shared authoritative stats for UI, humans and AI. Undefined faction keeps legacy balance. */
export function unitStats(type:UnitType,player?:FactionPlayer):UnitDef{
 const base=UNITS[type],f=player?.faction;if(!f)return base;
 let hp=base.hp,damage=base.damage,armor=base.armor;
 if(f==='anuradhapura'&&type==='warElephant')hp*=1.1;
 if(f==='chola'&&['spearman','pikeman'].includes(type))damage*=1.15;
 if(f==='elara'&&['spearman','pikeman','swordsman'].includes(type))armor++;
 if(f==='jaffna'&&['archer','crossbowman'].includes(type))damage*=1.1;
 return {...base,name:unitName(type,player),hp:Math.round(hp),damage:Math.round(damage*100)/100,armor};
}
export function buildingStats(type:BuildingType,player?:FactionPlayer):BuildingDef{
 const base=BUILDINGS[type],f=player?.faction;if(!f)return base;
 let hp=base.hp,seconds=base.seconds,cost=base.cost;
 if(f==='polonnaruwa'&&type==='farm'||f==='dutch'&&type==='market')cost={...base.cost,wood:Math.ceil((base.cost.wood??0)*.8)};
 if(f==='polonnaruwa'&&(base.cost.stone??0)>0)seconds*=.85;
 if(f==='kandy'&&['tower','fortress'].includes(type))hp*=1.15;
 if(f==='portuguese'&&type==='fortress')hp*=1.2;
 return {...base,cost,hp:Math.round(hp),seconds,trains:factionUnitTypes(player,type)};
}
export function tradeReturn(player?:FactionPlayer):number{return player?.faction==='dutch'?80:player?.faction==='jaffna'?75:65;}
export function populationCost(type:UnitType):number{return UNITS[type].population??1;}
export function airborne(e:Pick<Entity,'kind'|'type'>):boolean{return e.kind==='unit'&&e.type==='danduMonara';}
export function flightHeight(e:Pick<Entity,'kind'|'type'>):number{return airborne(e)?3:0;}
export function canAttack(a:Entity,b:Entity):boolean{return !airborne(b)||(a.kind==='unit'?UNITS[a.type as UnitType].range>2:a.kind==='building'&&(BUILDINGS[a.type as BuildingType].range??0)>2);}
