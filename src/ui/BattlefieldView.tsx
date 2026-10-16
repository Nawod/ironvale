import {Compass} from 'lucide-react';
import {useEffect,useRef} from 'react';
import {Battlefield} from '../render/battlefield';
import type {BattlefieldHooks} from '../render/battlefield';
import type {BuildingType,Position,Snapshot} from '../sim/types';
import type {WallPlanPreview} from '../render/wall-planning';
export interface ViewHandle {center:(p:Position)=>void;metrics:()=>{fps:number;renderer:string};worldToScreen:(p:Position)=>Position;rotate:(angle:number)=>void;resetCamera:()=>void}
export function BattlefieldView({snapshot,selection=[],placement,wallPlan,movingBuilding,mode='',hooks,interactive=true,suspended=false,viewRef,cameraOpen=false,onToggleCamera}:{snapshot:Snapshot;selection?:number[];placement?:BuildingType;wallPlan?:{start:Position;preview?:WallPlanPreview};movingBuilding?:number;mode?:string;hooks:BattlefieldHooks;interactive?:boolean;suspended?:boolean;cameraOpen?:boolean;onToggleCamera?:()=>void;viewRef?:React.MutableRefObject<ViewHandle|undefined>}){
 const host=useRef<HTMLDivElement>(null),renderer=useRef<Battlefield|undefined>(undefined),latest=useRef({snapshot,selection,placement,mode,hooks});latest.current={snapshot,selection,placement,mode,hooks};
 useEffect(()=>{const field=new Battlefield(host.current!,{select:(...args)=>latest.current.hooks.select(...args),action:(...args)=>latest.current.hooks.action(...args),cancel:()=>latest.current.hooks.cancel(),error:(text)=>latest.current.hooks.error(text)},interactive);renderer.current=field;field.suspended=suspended;
  void field.init().then(()=>{field.update(latest.current.snapshot);if(viewRef)viewRef.current=field;}).catch(()=>latest.current.hooks.error('The battlefield needs WebGL. Enable hardware acceleration in your browser and reload.'));
  return()=>{field.destroy();renderer.current=undefined;if(viewRef)viewRef.current=undefined;};
 },[interactive]);
 useEffect(()=>{if(renderer.current)renderer.current.suspended=suspended;},[suspended]);
 useEffect(()=>{const field=renderer.current;if(field){field.update(snapshot);field.selection=selection;field.placement=placement;field.wallPlan=wallPlan;field.movingBuilding=movingBuilding;field.mode=mode;}},[snapshot,selection,placement,wallPlan,movingBuilding,mode]);
 return <div ref={host} className="battlefield" data-testid="battlefield">{interactive&&<div className="camera-controls" aria-label="Camera controls" data-open={cameraOpen}><button className="camera-toggle" aria-label="Camera tools" aria-expanded={cameraOpen} onClick={onToggleCamera}><Compass size={20}/></button><div className="camera-buttons" hidden={!cameraOpen}><button aria-label="Rotate camera left" title="Rotate left (Q)" onClick={()=>renderer.current?.rotate(-Math.PI/8)}>↶</button><button aria-label="Reset camera" title="Reset camera" onClick={()=>renderer.current?.resetCamera()}>◇</button><button aria-label="Rotate camera right" title="Rotate right (E)" onClick={()=>renderer.current?.rotate(Math.PI/8)}>↷</button></div></div>}</div>;
}
