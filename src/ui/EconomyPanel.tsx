import {Coins,Footprints,Hammer,Mountain,TreePine,Users,Wheat,Wrench,X} from 'lucide-react';
import {useEffect,useRef} from 'react';
import type {Snapshot} from '../sim/types';
import {summarizeWorkforce,type WorkforceGroup} from './workforce';
const JOBS=[['food','Food',Wheat],['wood','Wood',TreePine],['stone','Stone',Mountain],['gold','Gold',Coins],['idle','Idle villagers',Users],['building','Construction',Hammer],['repairing','Repairs',Wrench],['other','Other orders',Footprints]] as const;
export function EconomyPanel({snapshot:s,select,onClose}:{snapshot:Snapshot;select:(ids:number[])=>void;onClose:()=>void}){
 const panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previous=document.activeElement;close.current?.focus();return()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[]);
 const workforce=summarizeWorkforce(s.entities,s.playerId),queued=s.entities.reduce((n,e)=>n+(e.owner===s.playerId?e.queue.filter(q=>q.kind==='unit').length:0),0);
 const choose=(group:WorkforceGroup)=>{select(workforce.groups[group]);onClose();};
 return <div className="economy-backdrop"><section ref={panel} className="economy-panel modal" role="dialog" aria-modal="true" aria-label="Economy overview" onKeyDown={event=>{if(event.key!=='Tab')return;const buttons=[...panel.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}>
  <button ref={close} className="close" aria-label="Close economy overview" onClick={onClose}><X size={20}/></button><h2>Your working city</h2>
  <p>{workforce.total} villagers · {queued} recruits queued</p><p className="economy-guidance">Select a job to find those villagers. New orders keep their earlier tasks saved.</p>
  <div className="workforce-grid">{JOBS.map(([key,label,Icon])=><button key={key} aria-label={`Select ${label.toLowerCase()} workers (${workforce.groups[key].length})`} disabled={!workforce.groups[key].length} onClick={()=>choose(key)}><Icon size={22}/><span>{label}</span><strong>{workforce.groups[key].length}</strong></button>)}</div>
  <p className="economy-footnote">Gatherers include villagers walking to resources or bringing a load home. Construction and repairs are counted separately.</p>
 </section></div>;
}
