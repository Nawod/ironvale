import {parentPort,workerData} from 'node:worker_threads';
import {createGame} from '../src/sim/world';
import {decodeSave,encodeSave} from '../src/sim/save';
import {step,command} from '../src/sim/engine';
import {snapshot} from '../src/sim/visibility';
import type {Command,MatchConfig} from '../src/sim/types';
const port=parentPort!;
const state=workerData.state?decodeSave(workerData.state):createGame(workerData.config as MatchConfig);
state.paused=false;
let frames=0,lastSavedTick=-1,finished=false;
const commands:{player:number;seq:number;command:Command}[]=[];
const publish=()=>{for(const p of state.players)if(p.controller==='human')port.postMessage({type:'snapshot',player:p.id,snapshot:snapshot(state,p.id)});};
const checkpoint=()=>port.postMessage({type:'checkpoint',state:encodeSave(state)});
port.on('message',m=>{
 if(m.type==='command'){if(commands.length<512)commands.push(m);else port.postMessage({type:'result',player:m.player,seq:m.seq,error:'The match is busy. Please try your order again.'});}
 else if(m.type==='controller'&&state.players[m.player]){state.players[m.player].controller=m.controller;checkpoint();}
 else if(m.type==='checkpoint')checkpoint();
});
setInterval(()=>{
 while(commands.length){const c=commands.shift()!;let error:string|null;try{error=command(state,{...c.command,player:c.player});}catch{error='This order could not be processed.';}port.postMessage({type:'result',player:c.player,seq:c.seq,error});}
 step(state);
 if(++frames%4===0)publish();
 if(state.tick>0&&state.tick%1200===0&&state.tick!==lastSavedTick){lastSavedTick=state.tick;checkpoint();}if(state.winner!==null&&!finished){finished=true;checkpoint();}
},50);
checkpoint();publish();
