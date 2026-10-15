import type {Entity,GameState,Order,WorkerTask} from './types';
import {bounds} from './navigation';
import {seen} from './visibility';
import {hostile} from './teams';
import {harvestedResource} from './nature';

export const MAX_WORKER_TASKS=128;
export function assign(e:Entity,order:Order):void{
 e.buildQueue=undefined;e.order=structuredClone(order);e.path=[];e.pathGoal=undefined;e.nextPathTick=0;e.home={x:e.x,y:e.y};
}
function sameTask(a:Order,b:Order):boolean{
 return a.kind===b.kind&&a.target===b.target&&a.point?.x===b.point?.x&&a.point?.y===b.point?.y;
}
function interrupted(e:Entity,order:Order):WorkerTask[]{
 const tasks=(e.taskQueue??[]).filter(t=>!sameTask(t.order,order));
 if(e.order.kind!=='idle'&&!sameTask(e.order,order))tasks.unshift({order:{...structuredClone(e.order),returning:undefined},...(e.buildQueue?.length?{buildQueue:[...e.buildQueue]}:{})});
 return tasks;
}
export function pendingTaskCount(e:Entity):number{
 return (e.buildQueue?.length??0)+(e.taskQueue??[]).reduce((sum,t)=>sum+1+(t.buildQueue?.length??0),0);
}
function wallsForTask(e:Entity,order:Order):number[]|undefined{
 return sameTask(e.order,order)?e.buildQueue:e.taskQueue?.find(t=>sameTask(t.order,order))?.buildQueue;
}
export function canAssignTask(e:Entity,order:Order):boolean{
 if(e.type!=='villager'||order.kind==='idle')return true;
 return interrupted(e,order).reduce((sum,t)=>sum+1+(t.buildQueue?.length??0),wallsForTask(e,order)?.length??0)<=MAX_WORKER_TASKS;
}
/** Only explicit commander/AI assignments interrupt work. Internal transitions use assign. */
export function assignTask(s:GameState,e:Entity,order:Order):void{
 if(e.type!=='villager'){assign(e,order);return;}
 const tasks=order.kind==='idle'?[]:interrupted(e,order),walls=order.kind==='idle'?undefined:wallsForTask(e,order);
 if(tasks.length&&e.order.kind!=='idle'&&!sameTask(e.order,order)&&e.order.target){
  const target=s.entities[e.order.target],known=target&&seen(s,e.owner,target)?target:s.intel[e.owner][e.order.target];
  if(known)tasks[0].lastKnown={x:known.x,y:known.y};
 }
 assign(e,order);e.buildQueue=walls;e.taskQueue=tasks.length?tasks:undefined;
}
function available(s:GameState,e:Entity,order:Order):boolean{
 if(['move','attackMove','patrol'].includes(order.kind))return !!order.point&&bounds(s,order.point);
 const target=order.target?s.entities[order.target]:undefined;if(!target||!seen(s,e.owner,target))return false;
 if(order.kind==='gather')return (target.kind==='resource'||target.type==='farm'&&target.owner===e.owner&&target.progress===1&&target.hp>0)&&!!harvestedResource(target)&&(target.amount>0||target.type==='farm'&&s.players[e.owner].resources.wood>=35);
 if(order.kind==='build'||order.kind==='repair')return target.kind==='building'&&target.owner===e.owner&&target.hp>0&&(order.kind==='build'?target.progress<1:target.progress===1&&target.hp<target.maxHp);
 return order.kind==='attack'&&target.hp>0&&!target.garrisoned&&hostile(s,e.owner,target.owner);
}
/** Harvesting cannot proceed with full/incompatible carry and no store. Keep it
 * remembered while executing available work, such as finishing a storehouse. */
export function resumeWithoutStore(s:GameState,e:Entity):boolean{
 const task=e.taskQueue?.find(t=>t.order.kind!=='gather'&&(available(s,e,t.order)||t.order.kind==='build'&&t.buildQueue?.some(target=>available(s,e,{kind:'build',target}))));
 if(!task)return false;assignTask(s,e,task.order);return true;
}
/** Skip obsolete work, retaining each worker's own order and paused wall sequence. */
export function resumeWorkerTask(s:GameState,e:Entity):boolean{
 if(e.type!=='villager'||e.garrisoned)return false;
 while(e.taskQueue?.length){
  const task=e.taskQueue.shift()!;
  let order=task.order,walls=task.buildQueue;
  // A paused wall can be finished/destroyed by somebody else before resumption.
  if(!available(s,e,order)&&order.kind==='build'&&walls?.length){
   walls=[...walls];while(walls.length){const target=walls.shift()!;if(available(s,e,{kind:'build',target})){order={kind:'build',target};break;}}
  }
  const target=order.target?s.entities[order.target]:undefined;
  if(task.lastKnown&&!s.visible[e.owner][Math.floor(task.lastKnown.y)*s.size+Math.floor(task.lastKnown.x)]&&!(target&&seen(s,e.owner,target))){
   e.taskQueue.unshift(task);assign(e,{kind:'move',point:{...task.lastKnown}});return true;
  }
  if(!available(s,e,order))continue;
  assign(e,{...order,returning:undefined});e.buildQueue=walls?.length?walls:undefined;if(!e.taskQueue.length)e.taskQueue=undefined;return true;
 }
 e.taskQueue=undefined;return false;
}
