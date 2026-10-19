import type { BuildingType, UnitType, Resources, Entity } from './types';
export interface BuildingDef { name: string; cost: Partial<Resources>; age: number; size: number; hp: number; seconds: number; capacity?: number; trains?: UnitType[]; range?: number; damage?: number; slots?: number }
export interface UnitDef { population?: number; name: string; cost: Partial<Resources>; age: number; hp: number; speed: number; damage: number; range: number; seconds: number; armor: number; sight: number }
export const BUILDINGS: Record<BuildingType, BuildingDef> = {
 capital:{name:'Town center',cost:{wood:240,stone:120},age:1,size:3,hp:1800,seconds:45,capacity:15,trains:['villager','scout'],range:6,damage:12},
 outpost:{name:'Outpost',cost:{wood:120},age:1,size:3,hp:900,seconds:25,capacity:5},
 house:{name:'House',cost:{wood:50},age:1,size:2,hp:400,seconds:12,capacity:10},
 storage:{name:'Storehouse',cost:{wood:80},age:1,size:2,hp:500,seconds:14},
 farm:{name:'Farm',cost:{wood:45},age:1,size:3,hp:250,seconds:10},
 barracks:{name:'Barracks',cost:{wood:150},age:1,size:3,hp:950,seconds:24,trains:['spearman','swordsman','pikeman']},
 palisade:{name:'Wooden wall',cost:{wood:8},age:1,size:1,hp:250,seconds:4},
 range:{name:'Archery range',cost:{wood:160},age:2,size:3,hp:800,seconds:25,trains:['archer','crossbowman']},
 stable:{name:'Stable',cost:{wood:180},age:2,size:3,hp:1000,seconds:28,trains:['cavalry','heavyCavalry']},
 smithy:{name:'Smithy',cost:{wood:120,gold:40},age:2,size:2,hp:700,seconds:20},
 market:{name:'Market',cost:{wood:140},age:2,size:3,hp:750,seconds:22},
 wall:{name:'Stone wall',cost:{stone:12},age:2,size:1,hp:800,seconds:6},
 gate:{name:'Gate',cost:{wood:25,stone:35},age:2,size:2,hp:950,seconds:12},
 tower:{name:'Watchtower',cost:{wood:60,stone:100},age:2,size:2,hp:1200,seconds:28,range:8,damage:18,slots:4},
 fortress:{name:'Fortress',cost:{wood:200,stone:350,gold:100},age:3,size:4,hp:3000,seconds:60,range:10,damage:28,slots:8},
 workshop:{name:'Siege workshop',cost:{wood:220,gold:100},age:3,size:3,hp:1100,seconds:35,trains:['ram','trebuchet']},
};
export const UNITS: Record<UnitType,UnitDef> = {
 villager:{name:'Villager',cost:{food:50},age:1,hp:55,speed:2.2,damage:3,range:1.3,seconds:10,armor:0,sight:6},
 scout:{name:'Scout',cost:{food:65},age:1,hp:95,speed:3.8,damage:6,range:1.4,seconds:14,armor:1,sight:11},
 spearman:{name:'Spearman',cost:{food:45,wood:20},age:1,hp:100,speed:2.3,damage:11,range:1.6,seconds:12,armor:1,sight:7},
 swordsman:{name:'Swordsman',cost:{food:60,gold:20},age:2,hp:145,speed:2.1,damage:17,range:1.4,seconds:16,armor:4,sight:7},
 archer:{name:'Archer',cost:{wood:40,gold:25},age:2,hp:75,speed:2.25,damage:11,range:6,seconds:15,armor:0,sight:8},
 cavalry:{name:'Cavalry',cost:{food:85,gold:40},age:2,hp:200,speed:3.5,damage:21,range:1.5,seconds:21,armor:3,sight:8},
 pikeman:{name:'Pikeman',cost:{food:65,wood:35,gold:15},age:2,hp:160,speed:2.05,damage:16,range:1.9,seconds:20,armor:3,sight:7},
 crossbowman:{name:'Crossbowman',cost:{wood:65,gold:45},age:3,hp:105,speed:2,damage:22,range:7,seconds:24,armor:2,sight:9},
 heavyCavalry:{name:'Heavy cavalry',cost:{food:130,gold:80},age:3,hp:320,speed:3.1,damage:30,range:1.6,seconds:32,armor:7,sight:8},
 warElephant:{name:'War elephant',cost:{food:260,gold:140},age:2,hp:650,speed:1.75,damage:34,range:1.8,seconds:45,armor:5,sight:8,population:4},
 champion:{name:'Champion',cost:{food:140,gold:100},age:3,hp:300,speed:2.15,damage:32,range:1.7,seconds:32,armor:7,sight:8,population:2},
 musketeer:{name:'Musketeer',cost:{food:75,gold:80},age:3,hp:110,speed:1.95,damage:34,range:7,seconds:28,armor:2,sight:9},
 rifleman:{name:'Rifleman',cost:{food:100,gold:110},age:3,hp:140,speed:2.05,damage:42,range:8,seconds:36,armor:3,sight:10,population:2},
 cannon:{name:'Cannon',cost:{wood:220,gold:220},age:3,hp:230,speed:1,damage:85,range:10,seconds:48,armor:4,sight:10,population:4},
 danduMonara:{name:'Dandu Monara',cost:{food:500,wood:400,gold:600},age:3,hp:500,speed:3.1,damage:28,range:6,seconds:90,armor:3,sight:11,population:8},
 zombie:{name:'Zombie',cost:{},age:1,hp:105,speed:1.45,damage:11,range:1.25,seconds:0,armor:1,sight:9},
 ram:{name:'Battering ram',cost:{wood:130,gold:60},age:3,hp:350,speed:1.3,damage:48,range:1.8,seconds:28,armor:10,sight:6},
 trebuchet:{name:'Trebuchet',cost:{wood:160,gold:100},age:3,hp:200,speed:1.1,damage:70,range:12,seconds:35,armor:3,sight:9},
};
export interface WallUpgrade {name:string;age:2|3;cost:Partial<Resources>;seconds:number;hp:number}
export function wallUpgrade(e:Entity):WallUpgrade|undefined{
 if(e.kind!=='building')return undefined;
 if(e.type==='palisade')return{name:'Stone wall',age:2,cost:{stone:12},seconds:6,hp:800};
 if(e.type==='wall'&&e.wallTier!==3)return{name:'Reinforced stone wall',age:3,cost:{stone:24,gold:8},seconds:10,hp:1400};
 return undefined;
}
export const COLORS=['#2f86d9','#d8483d','#e1b735','#9e60d1','#35a568','#db65a6','#ded6bd','#df882e'];
export const AGE_NAMES=['','Settlement','Town','Fortified Empire'];
export const AGE_COSTS=[{}, {food:400,gold:150}, {food:700,gold:350,stone:150}] as Partial<Resources>[];
export const TICK_RATE=20;
