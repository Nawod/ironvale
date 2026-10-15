import {it,expect,vi} from 'vitest';
import {VoiceChat} from '../src/net/voice';
import type {RoomView} from '../src/net/protocol';
const room={code:'ABC234',mode:'teams',players:[{id:'a',seat:0,name:'A',team:0,connected:true,controller:'human'},{id:'b',seat:1,name:'B',team:0,connected:true,controller:'human'},{id:'c',seat:2,name:'C',team:1,connected:true,controller:'human'}]} as RoomView;
const peer=(id='a',session=1,channel='open')=>({id,session,channel,muted:true,seat:id==='a'?0:1,name:id.toUpperCase(),team:0});
function fixture(pending?:Promise<any>){
 const track={enabled:true,stop:vi.fn(),onended:null},stream={getAudioTracks:()=>[track],getTracks:()=>[track]},sent:any[]=[],connections:any[]=[],audios:any[]=[];
 const voice=new VoiceChat(m=>{sent.push(m);return true;},{initialEpoch:()=>0,supported:()=>true,getMedia:()=>pending??Promise.resolve(stream as any),loadIce:async()=>[],createAudio:()=>{const audio={autoplay:false,muted:false,srcObject:null,play:vi.fn(async()=>{}),pause:vi.fn(),remove:vi.fn()};audios.push(audio);return audio as any;},createConnection:()=>{const pc={connectionState:'new',signalingState:'stable',remoteDescription:null,localDescription:null,addTrack:vi.fn(),close:vi.fn(),createOffer:vi.fn(async()=>({type:'offer',sdp:'offer'})),createAnswer:vi.fn(async()=>({type:'answer',sdp:'answer'})),setLocalDescription:vi.fn(async function(this:any,d:any){this.localDescription=d;}),setRemoteDescription:vi.fn(async function(this:any,d:any){this.remoteDescription=d;}),addIceCandidate:vi.fn(async()=>{})};connections.push(pc);return pc as any;}});
 voice.attach(room,'a',true);return{voice,track,stream,sent,connections,audios};
}
it('joins only after a user action and starts muted before creating peers',async()=>{
 const f=fixture();expect(f.sent).toHaveLength(0);await f.voice.join('open');expect(f.track.enabled).toBe(false);expect(f.sent.at(-1)).toMatchObject({type:'voiceState',channel:'open',muted:true,session:1});
 f.voice.receive({type:'voicePeers',session:1,peers:[peer(),peer('b')]} as any);await vi.waitFor(()=>expect(f.connections[0].createOffer).toHaveBeenCalled());expect(f.voice.getSnapshot().status).toBe('joined');f.voice.toggleMute();expect(f.track.enabled).toBe(true);expect(f.sent.at(-1)).toMatchObject({muted:false});f.voice.leave();expect(f.track.stop).toHaveBeenCalled();expect(f.connections[0].close).toHaveBeenCalled();
});
it('closes open connections and mutes before switching to a new team epoch',async()=>{
 const f=fixture();await f.voice.join('open');f.voice.receive({type:'voicePeers',session:1,peers:[peer(),peer('b')]} as any);f.voice.toggleMute();f.voice.switchChannel('team');expect(f.track.enabled).toBe(false);expect(f.connections[0].close).toHaveBeenCalled();expect(f.sent.at(-1)).toMatchObject({channel:'team',session:2,muted:true});
 f.voice.receive({type:'voiceSignal',from:'b',session:1,targetSession:1,signal:{type:'description',description:{type:'offer',sdp:'stale'}}});expect(f.connections).toHaveLength(1);
 f.voice.receive({type:'voicePeers',session:2,peers:[peer('a',2,'team'),peer('b',1,'team')]} as any);expect(f.connections).toHaveLength(2);f.voice.destroy();
});
it('stops a microphone whose permission resolves after leaving',async()=>{
 let resolve!:(s:any)=>void;const f=fixture(new Promise(r=>resolve=r));const joining=f.voice.join('open');f.voice.leave();resolve(f.stream);await joining;expect(f.track.stop).toHaveBeenCalled();expect(f.sent.some(m=>m.type==='voiceState'&&m.channel==='open')).toBe(false);expect(f.voice.getSnapshot().status).toBe('idle');
});
it('stops all capture and connections on disconnect and never rejoins automatically',async()=>{
 const f=fixture();await f.voice.join('open');f.voice.receive({type:'voicePeers',session:1,peers:[peer(),peer('b')]} as any);f.voice.attach(room,'a',false);expect(f.track.stop).toHaveBeenCalled();expect(f.connections[0].close).toHaveBeenCalled();f.voice.attach(room,'a',true);expect(f.voice.getSnapshot().status).toBe('idle');
});
it('rejects team voice in free-for-all and reports microphone permission failure',async()=>{
 const f=fixture();f.voice.attach({...room,mode:'ffa'},'a',true);await f.voice.join('team');expect(f.sent).toHaveLength(0);expect(f.voice.getSnapshot().error).toMatch(/team/i);
 const denied=new VoiceChat(()=>true,{supported:()=>true,getMedia:async()=>{throw new DOMException('denied','NotAllowedError');}});denied.attach(room,'a',true);await denied.join('open');expect(denied.getSnapshot().status).toBe('idle');expect(denied.getSnapshot().error).toMatch(/microphone|permission/i);
});
