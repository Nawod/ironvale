import {createGame} from './sim/world';
import {step,command} from './sim/engine';
import {snapshot} from './sim/visibility';
import {decodeSave,encodeSave} from './sim/save';
import type {Command,GameState,MatchConfig} from './sim/types';
let state:GameState|undefined,lastAuto=0;
const publish=()=>{if(state)postMessage({type:'snapshot',snapshot:snapshot(state)});};
onmessage=(e:MessageEvent<{type:string;config?:MatchConfig;command?:Command;text?:string;paused?:boolean}>)=>{
 try{const m=e.data;
  if(m.type==='start'){state=createGame(m.config!);lastAuto=0;publish();}
  else if(m.type==='load'){state=decodeSave(m.text!);state.paused=true;lastAuto=state.tick;publish();}
  else if(m.type==='command'&&state){const error=command(state,{...m.command!,player:0});postMessage({type:'commandResult',error});publish();}
  else if(m.type==='pause'&&state){state.paused=!!m.paused;publish();}
  else if(m.type==='save'&&state)postMessage({type:'save',text:encodeSave(state),slot:'manual'});
 }catch(error){postMessage({type:'error',error:error instanceof Error?error.message:'The match could not be loaded.'});}
};
setInterval(()=>{if(!state)return;step(state);if(state.tick%4===0)publish();if(state.tick-lastAuto>=1200){lastAuto=state.tick;postMessage({type:'save',text:encodeSave(state),slot:'auto'});}},50);
