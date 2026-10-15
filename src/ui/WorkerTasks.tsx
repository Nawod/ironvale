import type {BuildingType,Entity,Order,Snapshot} from '../sim/types';
import {BUILDINGS} from '../sim/definitions';
import {resourceLabel} from '../sim/nature';
import {pendingTaskCount} from '../sim/tasks';

export function WorkerTasks({workers,snapshot}:{workers:Entity[];snapshot:Snapshot}){
 const count=workers.reduce((sum,w)=>sum+pendingTaskCount(w),0);if(!count)return null;
 const label=(order:Order)=>{
  const target=snapshot.entities.find(e=>e.id===order.target);
  if(order.kind==='gather')return `Gather ${target?target.type==='farm'?'farm food':resourceLabel(target).toLowerCase():'resources'}`;
  if(order.kind==='build'||order.kind==='repair')return `${order.kind==='build'?'Build':'Repair'} ${target?BUILDINGS[target.type as BuildingType]?.name??'building':'building'}`;
  return ({move:'Move to destination',attack:'Attack target',attackMove:'Advance to destination',patrol:'Patrol route'} as Partial<Record<Order['kind'],string>>)[order.kind]??'Continue work';
 };
 const worker=workers.length===1?workers[0]:undefined;
 return <details className="worker-tasks" data-testid="worker-tasks"><summary>{count} pending {count===1?'task':'tasks'}</summary>{worker?<ol>
  {worker.buildQueue?.map((target,index)=><li key={`wall-${index}`}>{label({kind:'build',target})}</li>)}
  {worker.taskQueue?.map((task,index)=><li key={`task-${index}`}>{label(task.order)}{task.buildQueue?.length?` and ${task.buildQueue.length} more wall segments`:''}</li>)}
 </ol>:<p>Each worker remembers their own assignments.</p>}<p>Resumes after the current task. Stop clears saved tasks.</p></details>;
}
