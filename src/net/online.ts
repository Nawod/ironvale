import type {ClientMessage,RoomView,RoomSettings} from './protocol';
import type {Snapshot} from '../sim/types';
import {VoiceChat} from './voice';
import type {Session,SessionMessage} from './session';
export interface OnlineState {status:'idle'|'connecting'|'connected'|'reconnecting';id?:string;room?:RoomView;queued?:{count:number;waiting:number};error?:string;playerId?:number}
const STORAGE='ironvale-online-seat';
const roomSettings=(room:RoomSettings):RoomSettings=>({capacity:room.capacity,fillAI:room.fillAI,difficulty:room.difficulty,seed:room.seed,mode:room.mode??'ffa',zombies:room.zombies??false,mapType:room.mapType??'lowlands',mapSize:room.mapSize??'large'});
export class OnlineSession implements Session {
 readonly voice=new VoiceChat(message=>{if(this.socket?.readyState!==WebSocket.OPEN)return false;this.socket.send(JSON.stringify(message));return true;});
 onmessage:Session['onmessage']=null;onStart?:(room:RoomView,playerId:number)=>void;onUpdate?:(state:OnlineState)=>void;
 state:OnlineState={status:'idle'};private socket?:WebSocket;private outbox:ClientMessage[]=[];private retry?:ReturnType<typeof setTimeout>;private attempts=0;private ended=false;private seq=0;private awaitingResume=false;private credential?:{code:string;token:string};private lastSnapshot?:Snapshot;
 private confirmedRoom?:RoomView;private pendingSettings?:{code:string;settings:RoomSettings[]};
 private pendingCommands=new Map<number,number|undefined>();
 private commandResult(seq:number,error:string|null,requestId?:number){this.onmessage?.({data:{type:'commandResult',seq,error,...(requestId!==undefined?{requestId}:{})}});}
 private failPendingCommands(error:string){const pending=[...this.pendingCommands];this.pendingCommands.clear();for(const [seq,requestId]of pending)this.commandResult(seq,error,requestId);}
 private discardPendingSettings(){if(this.pendingSettings&&this.confirmedRoom?.code===this.pendingSettings.code)this.state.room=this.confirmedRoom;this.pendingSettings=undefined;}
 private emit(){this.voice.attach(this.state.room,this.state.id,this.state.status==='connected');this.onUpdate?.({...this.state});}
 restore(){try{const text=sessionStorage.getItem(STORAGE);if(text){const c=JSON.parse(text);if(typeof c.code==='string'&&typeof c.token==='string'){this.credential=c;this.connect();}}}catch{this.clearCredential();}}
 private persist(){try{if(this.credential)sessionStorage.setItem(STORAGE,JSON.stringify(this.credential));else sessionStorage.removeItem(STORAGE);}catch{/* Reconnection still works until this tab reloads. */}}
 private clearCredential(){this.credential=undefined;this.persist();}
 private connect(){
  if(this.ended||this.socket&&(this.socket.readyState===WebSocket.OPEN||this.socket.readyState===WebSocket.CONNECTING))return;
  this.state.status=this.credential?'reconnecting':'connecting';this.emit();const url=new URL('/ws',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';const socket=new WebSocket(url);this.socket=socket;
  socket.onopen=()=>{if(this.socket!==socket)return;this.attempts=0;this.state.status='connected';this.state.error=undefined;this.lastSnapshot=undefined;this.emit();if(this.credential){this.awaitingResume=true;socket.send(JSON.stringify({type:'resume',...this.credential}));}for(const m of this.outbox.splice(0))socket.send(JSON.stringify(m));};
  socket.onmessage=e=>{if(this.socket!==socket)return;try{this.receive(JSON.parse(e.data));}catch{this.state.error='The server sent an incompatible update. Please reconnect.';this.emit();}};
  socket.onerror=()=>{};
  socket.onclose=e=>{if(this.socket!==socket||this.ended)return;this.socket=undefined;this.lastSnapshot=undefined;this.discardPendingSettings();this.failPendingCommands('Connection lost before this order was confirmed. Check your city before issuing it again.');
   if(e.code===4001){this.clearCredential();this.state={status:'idle',error:'Your empire is connected in another tab.'};this.emit();return;}
   if(this.credential){this.state.status='reconnecting';this.emit();const delay=Math.min(5000,500*Math.pow(2,this.attempts++));this.retry=setTimeout(()=>this.connect(),delay);}
   else{this.outbox=[];this.state={status:'idle',error:'Unable to reach the multiplayer server. Please try again.'};this.emit();}
  };
 }
 private receive(m:any){
  if(m.type==='voicePeers'||m.type==='voiceSignal'){this.voice.receive(m);return;}
  if(m.type==='welcome'){this.state.id=m.id;this.emit();}
  else if(m.type==='joined'){this.pendingSettings=undefined;this.confirmedRoom=m.room;this.awaitingResume=false;this.credential={code:m.room.code,token:m.token};this.seq=m.lastSeq;this.state={...this.state,room:m.room,queued:undefined,playerId:m.playerId,id:m.room.players.find((p:any)=>p.seat===m.playerId)?.id,error:undefined};if(['playing','finished'].includes(m.room.phase))this.persist();this.emit();}
  else if(m.type==='room'){
   this.confirmedRoom=m.room;const pending=this.pendingSettings,confirmed=roomSettings(m.room);
   if(pending){
    if(pending.code!==m.room.code||m.room.phase!=='lobby'||m.room.hostId!==this.state.id)this.pendingSettings=undefined;
    else if(Object.keys(confirmed).every(key=>confirmed[key as keyof RoomSettings]===pending.settings[0][key as keyof RoomSettings])){pending.settings.shift();if(!pending.settings.length)this.pendingSettings=undefined;}
   }
   this.state.room=this.pendingSettings?{...m.room,...this.pendingSettings.settings.at(-1),players:m.room.players.map((p:RoomView['players'][number])=>({...p,ready:false}))}:m.room;this.emit();
  }
  else if(m.type==='queued'){this.pendingSettings=undefined;this.confirmedRoom=undefined;this.state.queued={count:m.count,waiting:m.waiting};this.state.room=undefined;this.emit();}
  else if(m.type==='started'){this.pendingSettings=undefined;this.confirmedRoom=m.room;this.state.room=m.room;this.state.playerId=m.playerId;this.state.queued=undefined;this.lastSnapshot=undefined;this.persist();this.emit();this.onStart?.(m.room,m.playerId);}
  else if(m.type==='snapshot'){
   const packet=m.snapshot;if(!packet.terrain&&!this.lastSnapshot)return;
   const fog:number[]=packet.fog??[...this.lastSnapshot!.fog];for(let i=0;i<(packet.fogChanges?.length??0);i+=2)fog[packet.fogChanges[i]]=packet.fogChanges[i+1];
   const snapshot:Snapshot={...packet,terrain:packet.terrain??this.lastSnapshot!.terrain,fog};this.lastSnapshot=snapshot;this.onmessage?.({data:{type:'snapshot',snapshot}});
  }else if(m.type==='commandResult'){const requestId=this.pendingCommands.get(m.seq);this.pendingCommands.delete(m.seq);this.commandResult(m.seq,m.error,requestId);}
  else if(m.type==='error'){this.discardPendingSettings();this.state.error=m.error;if(this.awaitingResume){this.awaitingResume=false;this.clearCredential();this.state.room=undefined;this.state.playerId=undefined;}this.emit();this.onmessage?.({data:m});}
  else if(m.type==='closed'){this.failPendingCommands(m.error);this.discardPendingSettings();this.voice.leave(false);this.state.error=m.error;this.emit();this.onmessage?.({data:{type:'error',error:m.error}});}
  else if(m.type==='left'){this.failPendingCommands('You left the match before this order was confirmed.');this.pendingSettings=undefined;this.confirmedRoom=undefined;this.state.room=undefined;this.state.queued=undefined;this.clearCredential();this.emit();}
 }
 /** Compose rapid edits against the latest desired settings. Older room replies
  * update the roster without restoring stale controlled input values. */
 updateSettings(patch:Partial<RoomSettings>){
  const room=this.state.room;if(!room||room.phase!=='lobby'||room.hostId!==this.state.id||this.state.status!=='connected'||this.socket?.readyState!==WebSocket.OPEN)return;
  const settings=roomSettings({...room,...this.pendingSettings?.settings.at(-1),...patch}),prior=this.pendingSettings?.code===room.code?this.pendingSettings.settings:[];
  this.pendingSettings={code:room.code,settings:[...prior,settings]};this.state.room={...room,...settings,players:room.players.map(p=>({...p,ready:false}))};this.send({type:'settings',...settings});
 }
 send(message:ClientMessage){this.state.error=undefined;if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(message));else{this.outbox.push(message);this.connect();}this.emit();}
 leave(){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({type:'leave'}));this.failPendingCommands('You left the match before this order was confirmed.');this.pendingSettings=undefined;this.confirmedRoom=undefined;this.clearCredential();this.outbox=[];if(this.retry)clearTimeout(this.retry);this.state={status:this.socket?.readyState===WebSocket.OPEN?'connected':'idle',id:this.state.id};this.emit();}
 postMessage(message:SessionMessage){
  if(message.type==='command'){
   const seq=++this.seq;if(this.ended||this.socket?.readyState!==WebSocket.OPEN){this.commandResult(seq,this.ended?'This match session has ended.':'Reconnecting. Wait before issuing orders.',message.requestId);return;}
   this.pendingCommands.set(seq,message.requestId);
   try{this.send({type:'command',seq,command:message.command});}catch{this.pendingCommands.delete(seq);this.commandResult(seq,'This order could not be sent. Check your connection before trying again.',message.requestId);}
  }
  else if(message.type==='save')this.onmessage?.({data:{type:'error',error:'Online matches are saved by the server. Local saves are for single-player games.'}});
 }
 terminate(){this.ended=true;this.failPendingCommands('The match session ended before this order was confirmed.');this.voice.destroy();this.outbox=[];if(this.retry)clearTimeout(this.retry);this.socket?.close();}
}
