import type { BuildingType, UnitType, Resources } from './types';
export interface BuildingDef { name: string; cost: Partial<Resources>; age: number; size: number; hp: number; seconds: number; capacity?: number; trains?: UnitType[]; range?: number; damage?: number; slots?: number }
export interface UnitDef { name: string; cost: Partial<Resources>; age: number; hp: number; speed: number; damage: number; range: number; seconds: number; armor: number; sight: number }
export const BUILDINGS: Record<BuildingType, BuildingDef> = {
 capital:{name:'Town center',cost:{wood:240,stone:120},age:1,size:3,hp:1800,seconds:45,capacity:15,trains:['villager','scout'],range:6,damage:12},
 outpost:{name:'Outpost',cost:{wood:120},age:1,size:3,hp:900,seconds:25,capacity:5},
 house:{name:'House',cost:{wood:50},age:1,size:2,hp:400,seconds:12,capacity:10},
 storage:{name:'Storehouse',cost:{wood:80},age:1,size:2,hp:500,seconds:14},
 farm:{name:'Farm',cost:{wood:45},age:1,size:3,hp:250,seconds:10},
 barracks:{name:'Barracks',cost:{wood:150},age:1,size:3,hp:950,seconds:24,trains:['spearman','swordsman']},
 palisade:{name:'Palisade',cost:{wood:8},age:1,size:1,hp:250,seconds:4},
 range:{name:'Archery range',cost:{wood:160},age:2,size:3,hp:800,seconds:25,trains:['archer']},
 stable:{name:'Stable',cost:{wood:180},age:2,size:3,hp:1000,seconds:28,trains:['cavalry']},
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
 ram:{name:'Battering ram',cost:{wood:130,gold:60},age:3,hp:350,speed:1.3,damage:48,range:1.8,seconds:28,armor:10,sight:6},
 trebuchet:{name:'Trebuchet',cost:{wood:160,gold:100},age:3,hp:200,speed:1.1,damage:70,range:12,seconds:35,armor:3,sight:9},
};
export const COLORS=['#7eb8d0','#db795e','#d9b960','#a28acc'];
export const AGE_NAMES=['','Settlement','Town','Fortified Empire'];
export const AGE_COSTS=[{}, {food:400,gold:150}, {food:700,gold:350,stone:150}] as Partial<Resources>[];
export const TICK_RATE=20;
