import type {ClientMessage,RoomView,ServerMessage,VoiceChannel,VoicePeer,VoiceSignal} from './protocol';

type VoiceMessage=Extract<ServerMessage,{type:'voicePeers'|'voiceSignal'}>;
type VoiceCommand=Extract<ClientMessage,{type:'voiceState'|'voiceSignal'}>;
export interface VoiceView {status:'idle'|'joining'|'joined';channel:VoiceChannel;muted:boolean;deafened:boolean;peers:(VoicePeer&{connection:RTCPeerConnectionState})[];error?:string;playbackBlocked:boolean}
interface Platform {initialEpoch:()=>number;supported:()=>boolean;getMedia:()=>Promise<MediaStream>;loadIce:()=>Promise<RTCIceServer[]>;createConnection:(config:RTCConfiguration)=>RTCPeerConnection;createAudio:()=>HTMLAudioElement}
interface Link {peer:VoicePeer;pc:RTCPeerConnection;audio?:HTMLAudioElement;candidates:RTCIceCandidateInit[];pending:Promise<void>;epoch:number}
const DEFAULT_ICE:RTCIceServer[]=[{urls:'stun:stun.cloudflare.com:3478'}];
const initial=():VoiceView=>({status:'idle',channel:'open',muted:true,deafened:false,peers:[],playbackBlocked:false});
const platform:Platform={
 initialEpoch:()=>{const values=crypto.getRandomValues(new Uint32Array(2));return (values[0]&0xfffff)*4294967296+values[1];},
 supported:()=>!!globalThis.isSecureContext&&!!navigator.mediaDevices?.getUserMedia&&typeof RTCPeerConnection!=='undefined',
 getMedia:()=>navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}),
 loadIce:async()=>{try{const response=await fetch('/voice-config',{signal:AbortSignal.timeout(5000)});if(response.ok){const data=await response.json();if(Array.isArray(data.iceServers))return data.iceServers;}}catch{/* Direct and default STUN connections remain available. */}return DEFAULT_ICE;},
 createConnection:config=>new RTCPeerConnection(config),
 createAudio:()=>{const audio=document.createElement('audio');audio.autoplay=true;audio.hidden=true;document.body.append(audio);return audio;},
};

/** Owns capture and peers independently of the lobby/match React trees. */
export class VoiceChat {
 private state:VoiceView=initial();private listeners=new Set<()=>void>();private room?:RoomView;private id?:string;private connected=false;
 private stream?:MediaStream;private links=new Map<string,Link>();private iceServers:RTCIceServer[]=DEFAULT_ICE;private epoch=0;private operation=0;private membership=false;private disposed=false;private env:Platform;
 constructor(private send:(m:VoiceCommand)=>boolean,env:Partial<Platform>={}){this.env={...platform,...env};this.epoch=this.env.initialEpoch();}
 getSnapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private patch(next:Partial<VoiceView>){this.state={...this.state,...next};for(const listener of this.listeners)listener();}
 private publishPeers(peers?:VoicePeer[]){const source=peers??this.state.peers;this.patch({peers:source.filter(p=>p.id!==this.id).map(p=>({...p,connection:this.links.get(p.id)?.pc.connectionState??'new'}))});}
 attach(room:RoomView|undefined,id:string|undefined,connected:boolean){
  const before=this.room?.players?.find(p=>p.id===this.id),after=room?.players?.find(p=>p.id===id);
  if(!connected||!room||!after||after.controller!=='human'||this.room&&(room.code!==this.room.code||this.id!==id||before?.team!==after.team||this.room.mode!==room.mode))this.leave(false);
  this.room=room;this.id=id;this.connected=connected;
 }
 private permitted(channel:VoiceChannel){return this.connected&&this.room&&this.id&&this.room.players.some(p=>p.id===this.id&&p.connected&&p.controller==='human')&&(channel==='open'||this.room.mode==='teams'&&this.room.players.find(p=>p.id===this.id)?.team!==undefined);}
 async join(channel:VoiceChannel='open'):Promise<void>{
  if(this.disposed)return;
  if(!this.permitted(channel)){this.patch({error:channel==='team'?'Team voice is available in team matches.':'Join an online room before using voice.'});return;}
  if(this.state.status!=='idle'){if(this.state.status==='joined')this.switchChannel(channel);return;}
  if(!this.env.supported()){this.patch({error:'Microphone access needs HTTPS or localhost and a browser with voice support.'});return;}
  const attempt=++this.operation;this.epoch++;this.patch({status:'joining',channel,muted:true,error:undefined,playbackBlocked:false});
  try{
   const stream=await this.env.getMedia();for(const track of stream.getTracks())track.enabled=false;
   if(attempt!==this.operation||this.disposed){stream.getTracks().forEach(t=>t.stop());return;}
   if(!stream.getAudioTracks().length){stream.getTracks().forEach(t=>t.stop());throw new Error('No microphone was found.');}
   this.stream=stream;for(const track of stream.getAudioTracks())track.onended=()=>{if(this.stream===stream){this.leave();this.patch({error:'Your microphone disconnected. Join voice again to reconnect.'});}};
   const ice=await this.env.loadIce();if(attempt!==this.operation||this.disposed)return;this.iceServers=ice;this.membership=true;
   if(!this.send({type:'voiceState',channel,muted:true,session:this.epoch})){this.leave(false);this.patch({error:'Reconnect to the room before joining voice.'});}
  }catch(error){if(attempt!==this.operation)return;this.leave(false);const name=error instanceof Error?error.name:'';this.patch({error:name==='NotAllowedError'?'Allow microphone access in your browser, then join voice again.':name==='NotFoundError'?'No microphone was found. Connect one and join voice again.':'Voice could not access your microphone. Check your browser permissions and try again.'});}
 }
 switchChannel(channel:VoiceChannel){
  if(this.state.status!=='joined'||channel===this.state.channel)return;
  if(!this.permitted(channel)){this.patch({error:'Team voice is available in team matches.'});return;}
  for(const track of this.stream?.getTracks()??[])track.enabled=false;this.closeLinks();this.epoch++;this.patch({channel,status:'joining',muted:true,peers:[],error:undefined,playbackBlocked:false});
  if(!this.send({type:'voiceState',channel,muted:true,session:this.epoch})){this.leave(false);this.patch({error:'Reconnect to the room before joining voice.'});}
 }
 toggleMute(){
  if(this.state.status!=='joined')return;const muted=!this.state.muted;for(const track of this.stream?.getAudioTracks()??[])track.enabled=!muted;this.patch({muted});
  if(!this.send({type:'voiceState',channel:this.state.channel,muted,session:this.epoch})){this.leave(false);}
 }
 toggleDeafen(){const deafened=!this.state.deafened;for(const link of this.links.values())if(link.audio)link.audio.muted=deafened;this.patch({deafened});}
 async retryAudio(){this.patch({playbackBlocked:false});await Promise.all([...this.links.values()].filter(l=>l.audio).map(l=>this.play(l.audio!)));}
 leave(notify=true){
  this.operation++;const wasMember=this.membership;this.membership=false;
  for(const track of this.stream?.getTracks()??[]){track.enabled=false;track.onended=null;track.stop();}this.stream=undefined;this.closeLinks();
  if(wasMember){this.epoch++;if(notify)this.send({type:'voiceState',channel:null,muted:true,session:this.epoch});}
  if(this.state.status!=='idle'||this.state.peers.length)this.patch({...initial(),deafened:this.state.deafened});
 }
 destroy(){this.leave();this.disposed=true;this.listeners.clear();}
 receive(m:VoiceMessage){
  if(!this.membership||this.disposed)return;
  if(m.type==='voicePeers'){
   if(m.session!==this.epoch)return;
   const self=m.peers.find(p=>p.id===this.id&&p.session===this.epoch&&p.channel===this.state.channel);
   if(!self){this.leave(false);this.patch({error:'Voice membership changed. Join voice again.'});return;}
   const me=this.room?.players.find(p=>p.id===this.id),peers=m.peers.filter(p=>p.id!==this.id&&p.channel===self.channel&&(self.channel==='open'||this.room?.mode==='teams'&&p.team===me?.team));
   const wanted=new Map(peers.map(p=>[p.id,p]));for(const [id,link]of this.links)if(!wanted.has(id)||wanted.get(id)!.session!==link.peer.session)this.closeLink(id);
   this.patch({status:'joined'});for(const peer of peers){const prior=this.links.get(peer.id);if(prior)prior.peer=peer;else this.createLink(peer);}this.publishPeers(peers);return;
  }
  if(m.targetSession!==this.epoch||this.state.status!=='joined')return;const link=this.links.get(m.from);if(!link||link.peer.session!==m.session)return;
  link.pending=link.pending.then(()=>this.signal(link,m.signal)).catch(()=>{if(this.current(link))this.patch({error:'Voice could not connect to a player. Rejoin voice to try again.'});});
 }
 private current(link:Link){return this.membership&&link.epoch===this.epoch&&this.links.get(link.peer.id)===link;}
 private relay(link:Link,signal:VoiceSignal){if(this.current(link))this.send({type:'voiceSignal',to:link.peer.id,session:this.epoch,targetSession:link.peer.session,signal});}
 private createLink(peer:VoicePeer){
  let pc:RTCPeerConnection;try{pc=this.env.createConnection({iceServers:this.iceServers});}catch{this.patch({error:'This browser could not start a voice connection.'});return;}
  const link:Link={peer,pc,candidates:[],pending:Promise.resolve(),epoch:this.epoch};this.links.set(peer.id,link);
  for(const track of this.stream?.getAudioTracks()??[])pc.addTrack(track,this.stream!);
  pc.onicecandidate=e=>{if(e.candidate)this.relay(link,{type:'candidate',candidate:{...e.candidate.toJSON(),candidate:e.candidate.candidate}});};
  pc.onconnectionstatechange=()=>{if(!this.current(link))return;this.publishPeers();if(pc.connectionState==='failed')this.patch({error:'Voice connection failed. Rejoin voice or try another network.'});};
  pc.ontrack=e=>{if(!this.current(link)||e.track.kind!=='audio')return;if(link.audio){link.audio.pause();link.audio.remove();}const audio=this.env.createAudio();audio.autoplay=true;audio.muted=this.state.deafened;audio.srcObject=e.streams[0]??new MediaStream([e.track]);link.audio=audio;void this.play(audio);};
  // One deterministic offerer per pair avoids simultaneous offer collisions.
  if(this.id!<peer.id)link.pending=link.pending.then(async()=>{const offer=await pc.createOffer();if(!this.current(link))return;await pc.setLocalDescription(offer);if(pc.localDescription)this.relay(link,{type:'description',description:{type:'offer',sdp:pc.localDescription.sdp}});}).catch(()=>{if(this.current(link))this.patch({error:'Voice negotiation failed. Rejoin voice to try again.'});});
 }
 private async play(audio:HTMLAudioElement){try{await audio.play();}catch{if([...this.links.values()].some(l=>l.audio===audio))this.patch({playbackBlocked:true});}}
 private async signal(link:Link,signal:VoiceSignal){
  if(!this.current(link))return;const pc=link.pc;
  if(signal.type==='candidate'){if(pc.remoteDescription)await pc.addIceCandidate(signal.candidate);else if(link.candidates.length<64)link.candidates.push(signal.candidate);return;}
  const description=signal.description;if(description.type==='offer'&&this.id!<link.peer.id)return;
  await pc.setRemoteDescription(description);if(!this.current(link))return;
  for(const candidate of link.candidates.splice(0)){if(!this.current(link))return;await pc.addIceCandidate(candidate);}
  if(description.type==='offer'){const answer=await pc.createAnswer();if(!this.current(link))return;await pc.setLocalDescription(answer);if(pc.localDescription)this.relay(link,{type:'description',description:{type:'answer',sdp:pc.localDescription.sdp}});}
 }
 private closeLink(id:string){const link=this.links.get(id);if(!link)return;this.links.delete(id);link.pc.onicecandidate=null;link.pc.ontrack=null;link.pc.onconnectionstatechange=null;link.pc.close();if(link.audio){link.audio.pause();const stream=link.audio.srcObject as MediaStream|null;stream?.getTracks().forEach(t=>t.stop());link.audio.srcObject=null;link.audio.remove();}}
 private closeLinks(){for(const id of [...this.links.keys()])this.closeLink(id);}
}
