import {Worker} from 'node:worker_threads';
import type {Command} from '../src/sim/types';
import {decodeSave,encodeSave} from '../src/sim/save';
import type {Room,MatchDriver,DriverCallbacks} from './rooms';
export class WorkerDriver implements MatchDriver {
 private worker:Worker;private stopped=false;private waiters:(()=>void)[]=[];
 constructor(room:Room,callbacks:DriverCallbacks,workerURL:URL){
  this.worker=new Worker(workerURL,{workerData:{config:room.config,state:room.lastState?encodeSave(room.lastState):undefined}});
  this.worker.on('message',m=>{
   if(this.stopped)return;
   if(m.type==='snapshot')callbacks.snapshot(m.player,m.snapshot);
   else if(m.type==='result')callbacks.result(m.player,m.seq,m.error);
   else if(m.type==='checkpoint'){callbacks.checkpoint(decodeSave(m.state));this.waiters.splice(0).forEach(r=>r());}
  });
  this.worker.on('error',()=>{if(!this.stopped)callbacks.failure('The match server encountered a problem. Please return to the menu.');});
  this.worker.on('exit',code=>{if(!this.stopped&&code!==0)callbacks.failure('The match server stopped unexpectedly. Please return to the menu.');});
 }
 submit(player:number,seq:number,command:Command){if(!this.stopped)this.worker.postMessage({type:'command',player,seq,command});}
 controller(player:number,controller:'human'|'ai'){if(!this.stopped)this.worker.postMessage({type:'controller',player,controller});}
 checkpoint(){if(!this.stopped)this.worker.postMessage({type:'checkpoint'});}
 flush():Promise<void>{if(this.stopped)return Promise.resolve();return new Promise(resolve=>{const timer=setTimeout(resolve,3000);this.waiters.push(()=>{clearTimeout(timer);resolve();});this.checkpoint();});}
 stop(){this.stopped=true;this.waiters.splice(0).forEach(r=>r());void this.worker.terminate();}
}
