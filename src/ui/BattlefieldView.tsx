import {useEffect,useRef} from 'react';
import {Battlefield} from '../render/battlefield';
import type {BattlefieldHooks} from '../render/battlefield';
import type {BuildingType,Position,Snapshot} from '../sim/types';
export interface ViewHandle {center:(p:Position)=>void;metrics:()=>{fps:number;renderer:string};worldToScreen:(p:Position)=>Position;rotate:(angle:number)=>void;resetCamera:()=>void}
export function BattlefieldView({snapshot,selection=[],placement,mode='',hooks,interactive=true,viewRef}:{snapshot:Snapshot;selection?:number[];placement?:BuildingType;mode?:string;hooks:BattlefieldHooks;interactive?:boolean;viewRef?:React.MutableRefObject<ViewHandle|undefined>}){
 const host=useRef<HTMLDivElement>(null),renderer=useRef<Battlefield|undefined>(undefined),latest=useRef({snapshot,selection,placement,mode,hooks});latest.current={snapshot,selection,placement,mode,hooks};
 useEffect(()=>{const field=new Battlefield(host.current!,{select:(...args)=>latest.current.hooks.select(...args),action:(...args)=>latest.current.hooks.action(...args),cancel:()=>latest.current.hooks.cancel(),error:(text)=>latest.current.hooks.error(text)},interactive);renderer.current=field;
  void field.init().then(()=>{field.update(latest.current.snapshot);if(viewRef)viewRef.current=field;}).catch(()=>latest.current.hooks.error('The battlefield needs WebGL. Enable hardware acceleration in your browser and reload.'));
  return()=>{field.destroy();renderer.current=undefined;if(viewRef)viewRef.current=undefined;};
 },[interactive]);
 useEffect(()=>{const field=renderer.current;if(field){field.update(snapshot);field.selection=selection;field.placement=placement;field.mode=mode;}},[snapshot,selection,placement,mode]);
 return <div ref={host} className="battlefield" data-testid="battlefield">{interactive&&<div className="camera-controls" aria-label="Camera controls"><button aria-label="Rotate camera left" title="Rotate left (Q)" onClick={()=>renderer.current?.rotate(-Math.PI/8)}>↶</button><button aria-label="Reset camera" title="Reset camera" onClick={()=>renderer.current?.resetCamera()}>◇</button><button aria-label="Rotate camera right" title="Rotate right (E)" onClick={()=>renderer.current?.rotate(Math.PI/8)}>↷</button></div>}</div>;
}
