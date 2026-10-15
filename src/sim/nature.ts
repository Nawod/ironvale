import type {AnimalType,Entity,FoodSourceType,Resource} from './types';
export const FOOD_SOURCES:Record<FoodSourceType,{name:string;amount:number;speed:number;gatherRate:number}>={
 deer:{name:'Deer',amount:180,speed:1.1,gatherRate:3.6},
 cow:{name:'Wild cattle',amount:260,speed:.8,gatherRate:3.6},
 alpaca:{name:'Alpaca',amount:180,speed:.95,gatherRate:3.6},
 fox:{name:'Fox',amount:100,speed:1.5,gatherRate:3.6},
 berries:{name:'Fruit bushes',amount:150,speed:0,gatherRate:2.8},
};
export const ANIMAL_TYPES:AnimalType[]=['deer','cow','alpaca','fox'];
export function isAnimal(e:Pick<Entity,'kind'|'type'>):boolean{return e.kind==='resource'&&ANIMAL_TYPES.includes(e.type as AnimalType);}
export function harvestedResource(e:Pick<Entity,'kind'|'type'>):Resource|undefined{
 if(e.type==='farm'||e.kind==='resource'&&e.type in FOOD_SOURCES)return 'food';
 if(e.kind==='resource'&&['food','wood','stone','gold'].includes(e.type))return e.type as Resource;
}
export function validResource(type:string):boolean{return ['food','wood','stone','gold'].includes(type)||type in FOOD_SOURCES;}
export function resourceLabel(e:Pick<Entity,'kind'|'type'>):string{return FOOD_SOURCES[e.type as FoodSourceType]?.name??({wood:'Woodland',stone:'Stone deposit',gold:'Gold deposit',food:'Food'} as Record<string,string>)[e.type]??e.type;}
