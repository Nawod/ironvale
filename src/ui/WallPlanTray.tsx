import {Hammer,RotateCcw,X} from 'lucide-react';
import type {WallPlanPreview} from '../render/wall-planning';

export function WallPlanTray({started,preview,submitting,onBuild,onReset,onCancel}:{started:boolean;preview?:WallPlanPreview;submitting:boolean;onBuild:()=>void;onReset:()=>void;onCancel:()=>void}){
 const count=preview?.tiles.length??0,cost=Object.entries(preview?.cost??{}).map(([r,n])=>`${n} ${r}`).join(' · ');
 return <section className="wall-plan-tray" aria-label="Wall line planner" data-invalid={!!preview?.error}>
  <div className="wall-plan-copy" role="status" aria-live="polite">
   <strong>{preview?`${count} sections${preview.reused?` · ${preview.reused} existing`:''}`:started?'Choose an end':'Choose a start'}</strong>
   <span>{preview?(preview.error??`${cost} · Ready to build`):started?'Tap the end, then review the cost.':'Tap the battlefield to begin a wall line.'}</span>
   {preview?.error&&cost&&<span className="wall-plan-cost">{cost}</span>}
  </div>
  <div className="wall-plan-actions">
   <button aria-label="Start over" title="Choose a new start" onClick={onReset} disabled={!started||submitting}><RotateCcw size={16}/><span>Start over</span></button>
   <button className="wall-plan-build" onClick={onBuild} disabled={!preview||!!preview.error||submitting}><Hammer size={17}/>{submitting?'Building…':'Build line'}</button>
   <button aria-label="Cancel" onClick={onCancel}><X size={17}/><span>Cancel</span></button>
  </div>
 </section>;
}
