import type {Entity,Resource} from '../sim/types';
import {harvestedResource} from '../sim/nature';
import {pendingTaskCount} from '../sim/tasks';
export type WorkforceGroup=Resource|'idle'|'building'|'repairing'|'other';
export function summarizeWorkforce(entities:readonly Entity[],playerId:number):{total:number;groups:Record<WorkforceGroup,number[]>}{
 const groups:Record<WorkforceGroup,number[]>={food:[],wood:[],stone:[],gold:[],idle:[],building:[],repairing:[],other:[]},byId=new Map(entities.map(e=>[e.id,e])),seen=new Set<number>();
 for(const e of entities){
  if(e.owner!==playerId||e.kind!=='unit'||e.type!=='villager'||e.hp<=0||e.ghost||e.garrisoned!==undefined||seen.has(e.id))continue;
  seen.add(e.id);let group:WorkforceGroup='other';const source=byId.get(e.order.target??0);
  if(e.order.kind==='gather')group=(source&&harvestedResource(source))??e.carry?.resource??'other';
  else if(e.order.kind==='build')group='building';else if(e.order.kind==='repair')group='repairing';
  else if(e.order.kind==='idle')group=e.carry?.amount?e.carry.resource:pendingTaskCount(e)>0?'other':'idle';
  groups[group].push(e.id);
 }
 return{total:seen.size,groups};
}
