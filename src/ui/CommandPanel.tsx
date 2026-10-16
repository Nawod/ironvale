import {useEffect,useId,useState,type KeyboardEvent} from 'react';
import {ArrowRightLeft,ArrowUp,Castle,Coins,Flag,Footprints,Hammer,Hand,Leaf,Map,Mountain,Move,Shield,Swords,Trash2,TreePine,Users,Wheat} from 'lucide-react';
import {AGE_COSTS,AGE_NAMES,BUILDINGS,UNITS,wallUpgrade} from '../sim/definitions';
import {pendingTaskCount} from '../sim/tasks';
import {MAX_RECRUIT_BATCH,scaledCost} from '../sim/production';
import type {BuildingType,Entity,QueueItem,Resource,Snapshot} from '../sim/types';
import {EntityPortrait} from './EntityPortrait';
import {SelectionRoster} from './SelectionRoster';
import {WorkerTasks} from './WorkerTasks';

interface CommandPanelProps {
 snapshot:Snapshot;
 selected:Entity[];
 mode:string;
 placement?:BuildingType;
 issue:(command:any)=>void;
 select:(ids:number[])=>void;
 setMode:(mode:string)=>void;
 setPlacement:(building?:BuildingType)=>void;
 startWallLine?:(building:'palisade'|'wall')=>void;
}

type Tab='orders'|'build'|'tasks'|'train'|'improve'|'manage';
const TAB_LABELS:Record<Tab,string>={orders:'Orders',build:'Build',tasks:'Tasks',train:'Train',improve:'Improve',manage:'Manage'};
const RESOURCE_ICONS={food:Wheat,wood:TreePine,stone:Mountain,gold:Coins};

function costText(cost:Partial<Record<Resource,number>>):string {
 return Object.entries(cost).map(([resource,amount])=>`${amount} ${resource}`).join(' · ');
}

function buildingName(building:Entity):string {
 return building.type==='wall'&&building.wallTier===3?'Reinforced stone wall':BUILDINGS[building.type as BuildingType].name;
}

function ResourceCost({cost}:{cost:Partial<Record<Resource,number>>}) {
 return <span className="cost">{Object.entries(cost).map(([resource,amount])=>{
  const Icon=RESOURCE_ICONS[resource as Resource];
  return <span key={resource} title={resource}><Icon size={14} aria-hidden="true"/><span className="sr-only">{resource} </span>{amount}</span>;
 })}</span>;
}

export function CommandPanel({snapshot:s,selected,mode,placement,issue,select,setMode,setPlacement,startWallLine}:CommandPanelProps) {
 const pid=s.playerId,player=s.players[pid],primary=selected[0];
 const units=selected.filter(entity=>entity.owner===pid&&entity.kind==='unit');
 const workers=units.filter(entity=>entity.type==='villager'),soldiers=units.filter(entity=>entity.type!=='villager');
 const building=primary?.kind==='building'&&primary.owner===pid&&primary.hp>0?primary:undefined;
 const complete=building?.progress===1;
 const definition=building?BUILDINGS[building.type as BuildingType]:undefined;
 const nextWall=building?wallUpgrade(building):undefined;
 const originalCapital=!!building&&(building.type==='capital'||s.players.some(p=>p.capital===building.id));
 const canImprove=!!building&&complete&&(building.id===player.capital&&player.age<3||building.type==='smithy'||building.type==='palisade'||building.type==='wall');
 const tabs:Tab[]=building?[...(complete&&definition?.trains?.length?['train' as const]:[]),...(canImprove?['improve' as const]:[]),'manage']:workers.length?['orders','build','tasks']:units.length?['orders']:[];
 const category=building?'building':workers.length?'workers':units.length?'soldiers':'none';
 const context=`${primary?.id??'none'}:${category}:${tabs.join(',')}`;
 const [tabState,setTabState]=useState<{context:string;tab:Tab}>({context,tab:tabs[0]??'orders'});
 const activeTab=tabState.context===context&&tabs.includes(tabState.tab)?tabState.tab:tabs[0];
 const [removeConfirmation,setRemoveConfirmation]=useState<number>();
 const [tradeSell,setTradeSell]=useState<Resource>('wood'),[tradeBuy,setTradeBuy]=useState<Resource>('gold');
 const [recruitBatch,setRecruitBatch]=useState(1);
 const selectionKey=selected.map(entity=>entity.id).join(',');
 const id=useId();
 const pendingCount=workers.reduce((count,worker)=>count+pendingTaskCount(worker),0);

 useEffect(()=>setRemoveConfirmation(undefined),[selectionKey]);

 const activateTab=(tab:Tab)=>{setTabState({context,tab});setRemoveConfirmation(undefined);};
 const handleTabKey=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
  let next:number;
  if(event.key==='ArrowRight')next=(index+1)%tabs.length;
  else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=tabs.length-1;
  else return;
  event.preventDefault();event.stopPropagation();activateTab(tabs[next]);
  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
 };
 const stop=()=>{setPlacement(undefined);setMode('');issue({type:'order',ids:units.map(entity=>entity.id),order:{kind:'idle'}});};
 const queueLabel=(item:QueueItem)=>item.kind==='unit'?`Training ${UNITS[item.unit!].name}`:item.kind==='age'?'Advancing empire':item.kind==='wall'?`Upgrading to ${nextWall?.name??'wall'}`:`Researching ${item.kind}`;
 const queueRow=(item:QueueItem,index:number)=><div className="queue-item" key={index}><EntityPortrait type={item.kind==='unit'?item.unit!:item.kind==='wall'?'wall':building!.type} owner={pid} age={item.kind==='age'?Math.min(3,player.age+1):player.age} wallTier={item.kind==='wall'&&nextWall?.age===3?3:undefined}/><div className="queue-description"><span>{queueLabel(item)}</span><progress aria-label={item.kind==='unit'?`Training ${UNITS[item.unit!].name}`:item.kind==='wall'?'Wall upgrade progress':'Research progress'} max={item.total} value={item.total-item.remaining}/></div><small>{Math.ceil(item.remaining)}s left</small></div>;

 return <div className="command-panel">
  {tabs.length>0&&<div className="command-tabs" role="tablist" aria-label="Selected unit actions">{tabs.map((tab,index)=><button key={tab} id={`${id}-tab-${tab}`} role="tab" aria-selected={activeTab===tab} aria-controls={`${id}-panel-${tab}`} tabIndex={activeTab===tab?0:-1} className={activeTab===tab?'active':''} onClick={()=>activateTab(tab)} onKeyDown={event=>handleTabKey(event,index)}>{TAB_LABELS[tab]}{tab==='tasks'&&pendingCount>0?` (${pendingCount})`:''}</button>)}</div>}

  {activeTab?<div className="command-content" role="tabpanel" id={`${id}-panel-${activeTab}`} aria-labelledby={`${id}-tab-${activeTab}`} tabIndex={0}>
   {activeTab==='orders'&&<>
    <SelectionRoster selected={selected} playerId={pid} select={select} className="selection-roster-mobile"/>
    <div className="order-buttons">{[
     {key:'move',label:'Move',Icon:Move},
     {key:'attackMove',label:'Attack-move',Icon:Swords},
     {key:'patrol',label:'Patrol',Icon:Footprints},
     {key:'idle',label:'Stop',Icon:Hand},
     ...(workers.length?[{key:'gather',label:'Gather',Icon:Leaf},{key:'repair',label:'Repair',Icon:Hammer}]:[{key:'garrison',label:'Garrison',Icon:Castle}]),
    ].map(({key,label,Icon})=><button key={key} className={mode===key?'active':''} aria-pressed={key!=='idle'?mode===key:undefined} onClick={()=>{if(key==='idle')stop();else{setPlacement(undefined);setMode(key);}}}><Icon size={18} aria-hidden="true"/>{label}</button>)}</div>
    {!!soldiers.length&&<label className="stance-control">Army stance<select aria-label="Army stance" value={soldiers[0].stance} onChange={event=>issue({type:'stance',ids:soldiers.map(entity=>entity.id),stance:event.target.value})}><option value="aggressive">Aggressive</option><option value="defensive">Defensive</option><option value="hold">Hold position</option></select></label>}
    {!!soldiers.length&&<label className="stance-control">Formation<select aria-label="Army formation" value={soldiers[0].formation??'line'} onChange={event=>issue({type:'formation',ids:soldiers.map(entity=>entity.id),formation:event.target.value})}><option value="line">Line · melee in front</option><option value="box">Box · compact ranks</option><option value="spread">Spread · wider spacing</option></select></label>}
    <p className="command-guidance">Choose an order, then a destination or target on the battlefield.</p>
   </>}

   {activeTab==='build'&&<div className="building-buttons">{startWallLine&&(['palisade','wall'] as const).map(type=><button key={`line-${type}`} className="asset-button wall-line-choice" aria-label={`Build ${BUILDINGS[type].name} line`} disabled={player.age<BUILDINGS[type].age} onClick={()=>startWallLine(type)}><EntityPortrait type={type} owner={pid} age={player.age}/><span>{BUILDINGS[type].name} line<small className="duration">Choose start and end · Review cost</small></span></button>)}{Object.entries(BUILDINGS).filter(([type])=>!['capital','outpost'].includes(type)).map(([type,def])=><button key={type} className={'asset-button '+(placement===type&&mode!=='wallLine'?'active':'')} disabled={player.age<def.age} title={`${def.name}: ${costText(def.cost)} · ${def.seconds}s construction${player.age<def.age?' — unlocks in '+AGE_NAMES[def.age]:''}`} aria-label={`Build ${def.name}`} aria-pressed={placement===type&&mode!=='wallLine'} onClick={()=>{setMode('');setPlacement(type as BuildingType);}}><EntityPortrait type={type as BuildingType} owner={pid} age={player.age}/><span>{def.name}<ResourceCost cost={def.cost}/><small className="duration">{def.seconds}s construction</small></span></button>)}
    {s.entities.find(entity=>entity.id===player.capital)?.hp===0&&<button className="asset-button" onClick={()=>issue({type:'rebuild',workers:workers.map(entity=>entity.id)})}><Hammer size={22} aria-hidden="true"/><span>Rebuild capital</span></button>}
   </div>}

   {activeTab==='tasks'&&<>
    <WorkerTasks workers={workers} snapshot={s}/>
    {!pendingCount&&<p className="command-guidance">No saved tasks. New orders let villagers return to their earlier work.</p>}
    <button className="clear-tasks" onClick={stop}><Hand size={18} aria-hidden="true"/>Stop</button><p className="command-guidance">Stop clears current orders and all saved tasks.</p>
   </>}

   {activeTab==='train'&&building&&<div className="action-buttons"><label className="recruit-batch">Units per order<select aria-label="Recruitment batch size" value={recruitBatch} onChange={event=>setRecruitBatch(+event.target.value)}><option value={1}>1 unit</option><option value={MAX_RECRUIT_BATCH}>{MAX_RECRUIT_BATCH} units</option></select></label>{definition?.trains?.map(unit=><button key={unit} className="asset-button" aria-label={`Recruit ${recruitBatch===1?'':`${recruitBatch} `}${UNITS[unit].name}`} title={`${recruitBatch} × ${UNITS[unit].name}: ${costText(scaledCost(UNITS[unit].cost,recruitBatch))} · ${UNITS[unit].seconds*recruitBatch}s sequential training`} disabled={player.age<UNITS[unit].age} onClick={()=>issue({type:'recruit',building:building.id,unit,count:recruitBatch})}><EntityPortrait type={unit} owner={pid} age={player.age}/><span>{recruitBatch>1?`${recruitBatch} × `:''}{UNITS[unit].name}<ResourceCost cost={scaledCost(UNITS[unit].cost,recruitBatch)}/><small className="duration">{UNITS[unit].seconds*recruitBatch}s {recruitBatch>1?'total training':'training'}</small></span></button>)}<button className="asset-button rally-set" aria-label="Set rally point" aria-pressed={mode==='rally'} onClick={()=>{setPlacement(undefined);setMode('rally');}}><Flag size={23}/><span>Set rally point<small className="duration">Choose ground or a resource</small></span></button>{building.rally&&<button className="asset-button" aria-label="Clear rally point" onClick={()=>issue({type:'clearRally',building:building.id})}><Hand size={23}/><span>Clear rally point<small className="duration">New recruits stay here</small></span></button>}</div>}

   {activeTab==='improve'&&building&&<div className="action-buttons">
    {building.id===player.capital&&player.age<3&&<button className="asset-button research-button" onClick={()=>issue({type:'research',building:building.id,research:'age'})}><ArrowUp size={24} aria-hidden="true"/><span>Advance to {AGE_NAMES[player.age+1]}<ResourceCost cost={AGE_COSTS[player.age]}/><small className="duration">45s research</small></span></button>}
    {building.type==='smithy'&&(['weapons','armor'] as const).map(research=><button className="asset-button research-button" key={research} onClick={()=>issue({type:'research',building:building.id,research})}>{research==='weapons'?<Swords size={24} aria-hidden="true"/>:<Shield size={24} aria-hidden="true"/>}<span>Upgrade {research}<small>Level {player[research]+1}</small><ResourceCost cost={{food:100*(player[research]+1),gold:80*(player[research]+1)}}/><small className="duration">30s research</small></span></button>)}
    {nextWall&&<button className="asset-button wall-upgrade" aria-label={`Upgrade to ${nextWall.name}`} disabled={player.age<nextWall.age||building.queue.length>0||Object.entries(nextWall.cost).some(([resource,amount])=>player.resources[resource as Resource]<amount!)} onClick={()=>issue({type:'upgradeWall',building:building.id})}><Shield size={24} aria-hidden="true"/><span>Upgrade to {nextWall.name}<ResourceCost cost={nextWall.cost}/><small className="duration">{nextWall.seconds}s upgrade</small></span></button>}
    {nextWall&&player.age<nextWall.age&&<p className="wall-guidance">Requires town hall level {nextWall.age}</p>}
    {building.type==='wall'&&building.wallTier===3&&<p className="wall-guidance">Maximum wall strength</p>}
   </div>}

   {activeTab==='manage'&&building&&<>
    {complete&&<>
     <div className="action-buttons">{!!building.garrison.length&&<button onClick={()=>issue({type:'ungarrison',building:building.id})}><Users size={20} aria-hidden="true"/>Release garrison ({building.garrison.length})</button>}
      {building.type==='farm'&&<button onClick={()=>{select(s.entities.filter(entity=>entity.owner===pid&&entity.type==='villager'&&entity.order.kind==='idle').slice(0,1).map(entity=>entity.id));setMode('gather');}}><Wheat size={20} aria-hidden="true"/>Assign a farmer</button>}
     </div>
     {building.type==='market'&&<div className="trade"><select aria-label="Sell resource" value={tradeSell} onChange={event=>setTradeSell(event.target.value as Resource)}>{Object.keys(RESOURCE_ICONS).map(resource=><option key={resource}>{resource}</option>)}</select><ArrowRightLeft size={16} aria-hidden="true"/><select aria-label="Buy resource" value={tradeBuy} onChange={event=>setTradeBuy(event.target.value as Resource)}>{Object.keys(RESOURCE_ICONS).map(resource=><option key={resource}>{resource}</option>)}</select><button onClick={()=>issue({type:'trade',sell:tradeSell,buy:tradeBuy})}>Exchange 100 for 65</button></div>}
    </>}
    <div className="building-management">{originalCapital?<p>Town centers stay fixed to protect the conquest objective.</p>:<>
     <div className="management-buttons"><button aria-label="Move building" aria-pressed={mode==='relocate'} disabled={!complete||!!building.queue.length||!!building.garrison.length} onClick={()=>{setRemoveConfirmation(undefined);setPlacement(building.type as BuildingType);setMode('relocate');}}><Move size={18} aria-hidden="true"/>Move building</button><button aria-label="Remove building" disabled={!!building.queue.length||!!building.garrison.length} onClick={()=>setRemoveConfirmation(building.id)}><Trash2 size={18} aria-hidden="true"/>Remove building</button></div>
     {removeConfirmation===building.id?<div className="remove-confirmation" role="group" aria-label="Confirm building removal"><p>Remove {buildingName(building)} permanently? Resources are not refunded.</p><button aria-label="Confirm removal" onClick={()=>{issue({type:'removeBuilding',building:building.id});setRemoveConfirmation(undefined);}}>Confirm removal</button><button onClick={()=>setRemoveConfirmation(undefined)}>Keep building</button></div>:<p>Empty the queue and garrison first. Buildings must be clear of enemies and safe from attacks for 10 seconds. Moving preserves damage and upgrades.</p>}
    </>}</div>
   </>}
  </div>:<div className="command-content command-hint"><Map size={24} aria-hidden="true"/><p>Select your villagers, soldiers, or a building to give orders.</p><small>Explore the land. Shape its future.</small></div>}

  {building&&building.queue.length>0&&<div className="queue" aria-label="Production queue">{building.queue[0].kind==='unit'&&s.population>=s.capacity&&<p className="production-paused" role="status">Training paused: build houses for more population.</p>}{queueRow(building.queue[0],0)}{building.queue.length===2?queueRow(building.queue[1],1):building.queue.length>2&&<details className="queue-more"><summary>{building.queue.length-1} more queued</summary>{building.queue.slice(1).map((item,index)=>queueRow(item,index+1))}</details>}</div>}
 </div>;
}
