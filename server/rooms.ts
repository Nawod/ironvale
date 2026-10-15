import {createHash,randomBytes} from 'node:crypto';
import {snapshot} from '../src/sim/visibility';
import type {Command,GameState,MatchConfig,Snapshot} from '../src/sim/types';
import type {ClientMessage,RoomSettings,RoomView,ServerMessage} from '../src/net/protocol';
import {validateTeams} from '../src/sim/teams';
export interface Peer {send:(message:ServerMessage)=>void;close:()=>void}
export interface Participant {id:string;name:string;connectionId?:string;tokenHash:string;ready:boolean;seat:number;team?:number;lastSeq:number;controller:'human'|'ai';disconnectedAt?:number}
export interface Room extends RoomSettings {code:string;kind:'private'|'public';phase:RoomView['phase'];hostId:string;players:Participant[];createdAt:number;countdownEnds?:number;config?:MatchConfig;driver?:MatchDriver;lastState?:GameState;endedAt?:number;emptySince?:number}
export interface MatchDriver {submit:(player:number,seq:number,command:Command)=>void;controller:(player:number,controller:'human'|'ai')=>void;stop:()=>void;checkpoint:()=>void}
export interface DriverCallbacks {snapshot:(player:number,snapshot:Snapshot)=>void;result:(player:number,seq:number,error:string|null)=>void;checkpoint:(state:GameState)=>void;failure:(error:string)=>void}
export interface RoomOptions {driver:(room:Room,callbacks:DriverCallbacks)=>MatchDriver;now?:()=>number;countdownMs?:number;reconnectMs?:number;maxRooms?:number;persist?:(room:Room)=>void;remove?:(code:string)=>void}
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
const AI_NAMES=['Redcliff','Goldmere','Duskwatch','Ashford','Silverfen','Briarhold','Stormreach'];
export class RoomService {
 readonly rooms=new Map<string,Room>();private peers=new Map<string,Peer>();private bindings=new Map<string,{room:Room;player:Participant}>();private queues=new Map<string,{id:string;name:string}[]>();private rate=new Map<string,{at:number;count:number}>();
 constructor(private options:RoomOptions){}
 private now(){return this.options.now?.()??Date.now();}
 connect(id:string,peer:Peer){this.peers.set(id,peer);peer.send({type:'welcome',id,protocol:1});}
 private send(id:string|undefined,m:ServerMessage){if(id)this.peers.get(id)?.send(m);}
 private error(id:string,message:string){this.send(id,{type:'error',error:message});}
 private view(room:Room):RoomView{return {code:room.code,kind:room.kind,phase:room.phase,capacity:room.capacity,fillAI:room.fillAI,difficulty:room.difficulty,seed:room.seed,mode:room.mode??'ffa',hostId:room.hostId,countdownEnds:room.countdownEnds,players:room.players.map(p=>({id:p.id,name:p.name,seat:p.seat,team:p.team,ready:p.ready,connected:!!p.connectionId,controller:p.controller}))};}
 private broadcast(room:Room){for(const p of room.players)this.send(p.connectionId,{type:'room',room:this.view(room)});}
 private code(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let value:string;do{value=[...randomBytes(6)].map(n=>alphabet[n%alphabet.length]).join('');}while(this.rooms.has(value));return value;}
 private free(id:string){return !this.bindings.has(id)&&![...this.queues.values()].some(q=>q.some(p=>p.id===id));}
 private newRoom(kind:Room['kind'],settings:RoomSettings,hostId:string):Room {if(this.rooms.size>=(this.options.maxRooms??32))throw new Error('The server is full. Please try again shortly.');const room:Room={...settings,code:this.code(),kind,hostId,phase:'lobby',players:[],createdAt:this.now()};this.rooms.set(room.code,room);return room;}
 private nextTeam(room:Room):number{const counts=[0,0];for(const p of room.players)if(p.team===0||p.team===1)counts[p.team]=(counts[p.team]??0)+1;return counts.indexOf(Math.min(...counts));}
 private add(room:Room,id:string,name:string,ready=false){const token=randomBytes(32).toString('hex'),player:Participant={id,name,connectionId:id,tokenHash:hash(token),ready,seat:room.players.length,team:room.mode==='teams'?this.nextTeam(room):undefined,lastSeq:0,controller:'human'};room.players.push(player);this.bindings.set(id,{room,player});this.send(id,{type:'joined',room:this.view(room),token,playerId:player.seat,lastSeq:0});this.broadcast(room);}
 handle(id:string,m:ClientMessage):void {
  if(!this.peers.has(id))return;const now=this.now(),bucket=this.rate.get(id);if(!bucket||now-bucket.at>=1000)this.rate.set(id,{at:now,count:1});else if(++bucket.count>40){this.error(id,'Too many orders. Please slow down.');return;}
  try{
   if(m.type==='create'){if(!this.free(id))throw new Error('Leave your current room or queue first.');const room=this.newRoom('private',{...m,capacity:8},id);this.add(room,id,m.name);return;}
   if(m.type==='join'){if(!this.free(id))throw new Error('Leave your current room or queue first.');const room=this.rooms.get(m.code);if(!room||room.kind!=='private')throw new Error('That room code was not found.');if(room.phase!=='lobby')throw new Error('This match has already started.');if(room.players.length>=room.capacity)throw new Error('This room is full.');this.add(room,id,m.name);return;}
   if(m.type==='queue'){if(!this.free(id))throw new Error('Leave your current room or queue first.');const key=`${m.mode??'ffa'}:${m.count}`,q=this.queues.get(key)??[];q.push({id,name:m.name});this.queues.set(key,q);this.match(key);return;}
   if(m.type==='resume'){if(!this.free(id))throw new Error('Leave your current room first.');const room=this.rooms.get(m.code),player=room?.players.find(p=>p.tokenHash===hash(m.token)&&p.controller==='human');if(!room||!player||!['playing','finished'].includes(room.phase)||player.disconnectedAt!==undefined&&now-player.disconnectedAt>=(this.options.reconnectMs??120000))throw new Error('This seat can no longer be reconnected.');const old=player.connectionId;if(old){this.bindings.delete(old);this.peers.get(old)?.close();}player.connectionId=id;player.disconnectedAt=undefined;room.emptySince=undefined;this.bindings.set(id,{room,player});this.send(id,{type:'joined',room:this.view(room),token:m.token,playerId:player.seat,lastSeq:player.lastSeq});this.send(id,{type:'started',room:this.view(room),playerId:player.seat});if(room.phase==='finished'&&room.lastState)this.send(id,{type:'snapshot',snapshot:snapshot(room.lastState,player.seat)});room.driver?.checkpoint();this.broadcast(room);return;}
   if(m.type==='cancel'||m.type==='leave'){this.leave(id,true);this.send(id,{type:'left'});return;}
   const binding=this.bindings.get(id);if(!binding)throw new Error('Join a match first.');const {room,player}=binding;
   if(m.type==='command'){if(room.phase!=='playing'||player.controller!=='human')throw new Error('Your empire cannot accept orders now.');if(m.seq<=player.lastSeq){this.send(id,{type:'commandResult',seq:m.seq,error:'This order was already submitted.'});return;}player.lastSeq=m.seq;room.driver?.submit(player.seat,m.seq,{...m.command,player:player.seat});return;}
   if(room.phase!=='lobby')throw new Error('Match settings are locked after starting.');
   if(m.type==='team'){if(room.kind!=='private'||room.mode!=='teams')throw new Error('Team choices are only available in team rooms.');const seat=m.seat??player.seat;if(seat!==player.seat&&room.hostId!==player.id)throw new Error('Only the host can arrange another player.');const target=room.players.find(p=>p.seat===seat);if(!target)throw new Error('That seat is no longer available.');if(room.players.filter(p=>p!==target&&p.team===m.team).length>=4)throw new Error('A team can have at most four players.');if(target.team!==m.team){target.team=m.team;room.players.forEach(p=>p.ready=false);}this.broadcast(room);return;}
   if(m.type==='ready'){player.ready=m.ready;this.broadcast(room);return;}
   if(m.type==='settings'){if(room.kind!=='private'||room.hostId!==player.id)throw new Error('Only the room host can change settings.');const changed=(room.mode??'ffa')!==(m.mode??'ffa');Object.assign(room,{capacity:8,fillAI:m.fillAI,difficulty:m.difficulty,seed:m.seed,mode:m.mode??'ffa'});if(changed)room.players.forEach((p,i)=>p.team=room.mode==='teams'?i%2:undefined);room.players.forEach(p=>p.ready=false);this.broadcast(room);return;}
   if(m.type==='start'){if(room.kind!=='private'||room.hostId!==player.id)throw new Error('Only the room host can start this match.');if(room.players.length<2)throw new Error('Wait for at least one friend to join.');if(room.players.some(p=>!p.ready||!p.connectionId))throw new Error('Everyone must be ready before starting.');this.start(room);return;}
  }catch(error){this.error(id,error instanceof Error?error.message:'The request could not be completed.');}
 }
 private start(room:Room){
  const capacity=room.kind==='private'&&!room.fillAI?room.players.length:room.capacity;
  const participants:NonNullable<MatchConfig['participants']>=room.players.map(p=>({name:p.name,controller:p.controller,team:room.mode==='teams'?p.team:undefined}));
  for(let i=participants.length;i<capacity;i++){let team:number|undefined;if(room.mode==='teams'){const teams=[...new Set(participants.map(p=>p.team!))];if(teams.length<2)teams.push(teams[0]===0?1:0);team=teams.sort((a,b)=>participants.filter(p=>p.team===a).length-participants.filter(p=>p.team===b).length||a-b).find(t=>participants.filter(p=>p.team===t).length<4);if(team===undefined)throw new Error('Every team is full.');}participants.push({name:AI_NAMES[(i-room.players.length)%AI_NAMES.length],controller:'ai',team});}
  validateTeams(participants);room.capacity=capacity;
  room.config={opponents:(room.capacity-1) as MatchConfig['opponents'],difficulty:room.difficulty,seed:room.seed,participants};room.phase='playing';room.countdownEnds=undefined;
  room.driver=this.options.driver(room,this.callbacks(room));for(const p of room.players)this.send(p.connectionId,{type:'started',room:this.view(room),playerId:p.seat});this.broadcast(room);
 }
 private callbacks(room:Room):DriverCallbacks{return{
  snapshot:(player,s)=>{const p=room.players.find(p=>p.seat===player);this.send(p?.connectionId,{type:'snapshot',snapshot:s});if(s.winner!==null&&room.phase==='playing'){room.phase='finished';room.endedAt=this.now();this.broadcast(room);}},
  result:(seat,seq,error)=>this.send(room.players.find(p=>p.seat===seat)?.connectionId,{type:'commandResult',seq,error}),
  checkpoint:s=>{room.lastState=s;this.options.persist?.(room);},
  failure:error=>{for(const p of room.players)this.send(p.connectionId,{type:'closed',error});this.delete(room);}
 };}
 private match(key:string){const [mode,number]=key.split(':'),count=Number(number),q=this.queues.get(key)??[];while(q.length>=count&&this.rooms.size<(this.options.maxRooms??32)){const entries=q.splice(0,count),room=this.newRoom('public',{capacity:count,fillAI:false,mode:mode as 'ffa'|'teams',difficulty:'normal',seed:randomBytes(4).readUInt32LE()},entries[0].id);for(const e of entries)this.add(room,e.id,e.name,true);room.phase='countdown';room.countdownEnds=this.now()+(this.options.countdownMs??3000);this.broadcast(room);}this.queueUpdate(key);}
 private queueUpdate(key:string){const count=Number(key.split(':')[1]),q=this.queues.get(key)??[];for(const e of q)this.send(e.id,{type:'queued',count,waiting:q.length});}
 private leave(id:string,explicit:boolean){
  for(const [count,q]of this.queues){const i=q.findIndex(e=>e.id===id);if(i>=0){q.splice(i,1);this.queueUpdate(count);}}
  const b=this.bindings.get(id);if(!b)return;this.bindings.delete(id);const {room,player}=b;
  if(room.phase==='playing'||room.phase==='finished'){player.connectionId=undefined;player.disconnectedAt=this.now();if(explicit)this.takeover(room,player);if(!room.players.some(p=>p.connectionId))room.emptySince=this.now();room.driver?.checkpoint();this.broadcast(room);return;}
  room.players=room.players.filter(p=>p!==player);
  if(room.phase==='countdown'){for(const p of room.players){this.bindings.delete(p.connectionId!);const key=`${room.mode??'ffa'}:${room.capacity}`,q=this.queues.get(key)??[];q.push({id:p.connectionId!,name:p.name});this.queues.set(key,q);this.send(p.connectionId,{type:'left'});}this.delete(room);this.match(`${room.mode??'ffa'}:${room.capacity}`);return;}
  room.players.forEach((p,i)=>p.seat=i);if(room.hostId===player.id)room.hostId=room.players[0]?.id??'';if(!room.players.length)this.delete(room);else this.broadcast(room);
 }
 private takeover(room:Room,p:Participant){p.controller='ai';p.tokenHash='';room.driver?.controller(p.seat,'ai');room.driver?.checkpoint();}
 disconnect(id:string){this.leave(id,false);this.peers.delete(id);this.rate.delete(id);}
 sweep(){const now=this.now();for(const room of this.rooms.values()){
  if(room.phase==='countdown'&&now>=(room.countdownEnds??Infinity)){if(room.players.every(p=>p.connectionId))this.start(room);continue;}
  if(room.phase==='lobby'&&now-room.createdAt>3600000){for(const p of room.players)this.send(p.connectionId,{type:'closed',error:'This waiting room expired. Create a new room.'});this.delete(room);continue;}
  if(room.phase==='playing'){for(const p of room.players)if(p.controller==='human'&&p.disconnectedAt!==undefined&&now-p.disconnectedAt>=(this.options.reconnectMs??120000))this.takeover(room,p);const humans=room.players.filter(p=>p.controller==='human');const allEliminated=room.lastState&&humans.every(p=>!room.lastState!.players[p.seat]?.alive);if(!humans.length||allEliminated){room.emptySince??=now;if(now-room.emptySince>30000)this.delete(room);}}
  if(room.phase==='finished'&&now-(room.endedAt??now)>600000)this.delete(room);
 }for(const [count,q]of this.queues)if(q.length>=Number(count.split(':')[1])&&this.rooms.size<(this.options.maxRooms??32))this.match(count);}
 private delete(room:Room){room.driver?.stop();for(const p of room.players){if(p.connectionId)this.bindings.delete(p.connectionId);}this.rooms.delete(room.code);this.options.remove?.(room.code);}
 restore(room:Room){room.players.forEach(p=>{p.connectionId=undefined;if(p.controller==='human')p.disconnectedAt=this.now();});room.createdAt=this.now();room.emptySince=undefined;this.rooms.set(room.code,room);if(room.phase==='playing'){room.driver=this.options.driver(room,this.callbacks(room));}else room.endedAt=this.now();}
 shutdown(){for(const room of this.rooms.values()){for(const p of room.players)this.send(p.connectionId,{type:'closed',error:'The server is restarting. Your match will reconnect when it returns.'});room.driver?.stop();}this.peers.clear();}
}
