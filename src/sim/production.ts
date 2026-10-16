import type {Resources} from './types';
export const MAX_RECRUIT_BATCH=5;
export function scaledCost(cost:Partial<Resources>,count:number):Partial<Resources>{
 return Object.fromEntries(Object.entries(cost).map(([resource,amount])=>[resource,amount!*count]));
}
