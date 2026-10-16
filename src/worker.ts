import {createGame} from './sim/world';
import {step,command} from './sim/engine';
import {snapshot} from './sim/visibility';
import {decodeSave,encodeSave} from './sim/save';
import type {GameState} from './sim/types';
import type {SessionMessage} from './net/session';
let state:GameState|undefined,lastAuto=0;
const publish=()=>{if(state)postMessage({type:'snapshot',snapshot:snapshot(state)});};
onmessage=(e:MessageEvent<SessionMessage>)=>{
 const m=e.data,request=m.type==='command'&&m.requestId!==undefined?{requestId:m.requestId}:{};
 try{
  if(m.type==='start'){state=createGame(m.config!);lastAuto=0;publish();}
  else if(m.type==='load'){state=decodeSave(m.text!);state.paused=true;lastAuto=state.tick;publish();}
  else if(m.type==='command'){const error=state?command(state,{...m.command,player:0}):'Start or load a match before issuing orders.';postMessage({type:'commandResult',error,...request});publish();}
  else if(m.type==='pause'&&state){state.paused=!!m.paused;publish();}
  else if(m.type==='save'&&state)postMessage({type:'save',text:encodeSave(state),slot:'manual'});
 }catch(error){postMessage({type:m.type==='command'?'commandResult':'error',error:error instanceof Error?error.message:'The request could not be completed.',...request});}
};
setInterval(()=>{if(!state)return;step(state);if(state.tick%4===0)publish();if(state.tick-lastAuto>=1200){lastAuto=state.tick;postMessage({type:'save',text:encodeSave(state),slot:'auto'});}},50);
