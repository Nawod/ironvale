import {expect,it} from 'vitest';
import {RoomService} from '../server/rooms';
import {validateMessage} from '../server/validation';
import type {Room,DriverCallbacks} from '../server/rooms';
import type {ServerMessage,VoiceChannel} from '../src/net/protocol';

const create={type:'create',name:'Host',capacity:8,fillAI:false,difficulty:'normal',seed:42};
const offer={type:'description',description:{type:'offer',sdp:'v=0\r\n'}};
const candidate={type:'candidate',candidate:{candidate:'candidate:1 1 udp 1 127.0.0.1 1234 typ host',sdpMid:null,sdpMLineIndex:0,usernameFragment:'ice'}};
function fixture(mode='ffa',count=2){
 let now=1000;const sent:Record<string,ServerMessage[]>={},closed:string[]=[],drivers:{room:Room;cb:DriverCallbacks}[]=[];
 const service=new RoomService({now:()=>now,countdownMs:10,reconnectMs:50,driver:(room,cb)=>{drivers.push({room,cb});return{submit(){},controller(){},stop(){},checkpoint(){}};}});
 const connect=(id:string)=>{sent[id]=[];service.connect(id,{send:m=>sent[id].push(m),close:()=>{closed.push(id);}});};
 const send=(id:string,m:unknown)=>service.handle(id,validateMessage(m));
 connect('p0');send('p0',{...create,mode});const joined=sent.p0.find(m=>m.type==='joined')!;if(joined.type!=='joined')throw new Error('Missing room');const code=joined.room.code;
 for(let i=1;i<count;i++){const id=`p${i}`;connect(id);send(id,{type:'join',name:`P${i}`,code});}
 const voice=(id:string,channel:VoiceChannel|null='open',session=1,muted=false)=>send(id,{type:'voiceState',channel,session,muted});
 const signal=(id:string,to:string,session=1,targetSession=1,payload:unknown=offer)=>send(id,{type:'voiceSignal',to,session,targetSession,signal:payload});
 const peers=(id:string)=>{const m=sent[id].filter(m=>m.type==='voicePeers').at(-1);return m?.type==='voicePeers'?m.peers:undefined;};
 const received=(id:string)=>sent[id].filter(m=>m.type==='voiceSignal');
 const start=()=>{for(let i=0;i<count;i++)send(`p${i}`,{type:'ready',ready:true});send('p0',{type:'start'});};
 return{service,sent,closed,drivers,connect,send,voice,signal,peers,received,start,code,token:joined.token,advance:(ms:number)=>{now+=ms;service.sweep();}};
}

it('validates bounded voice payloads and removes untrusted sender and nested extras',()=>{
 expect(()=>validateMessage({type:'voiceState',channel:'open',muted:false,session:1})).not.toThrow();
 expect(validateMessage({type:'voiceSignal',to:'peer',session:1,targetSession:2,from:'spoof',signal:{...offer,extra:true,description:{...offer.description,extra:true}}})).toEqual({type:'voiceSignal',to:'peer',session:1,targetSession:2,signal:offer});
 expect(validateMessage({type:'voiceSignal',to:'peer',session:1,targetSession:2,signal:{...candidate,candidate:{...candidate.candidate,extra:'discard'}}})).toEqual({type:'voiceSignal',to:'peer',session:1,targetSession:2,signal:candidate});
 for(const invalid of [
  {type:'voiceState',channel:'secret',muted:false,session:1},{type:'voiceState',channel:'open',muted:'no',session:1},
  ...[0,-1,1.2,Number.MAX_SAFE_INTEGER+1].map(session=>({type:'voiceState',channel:'open',muted:false,session})),
  ...['', 'x'.repeat(129)].map(to=>({type:'voiceSignal',to,session:1,targetSession:1,signal:offer})),
  {type:'voiceSignal',to:'peer',session:1,targetSession:0,signal:offer},
  ...[{type:'description',description:{type:'rollback',sdp:''}},{type:'description',description:{type:'offer',sdp:'x'.repeat(12001)}},{type:'candidate',candidate:{candidate:'x'.repeat(2049)}},{type:'candidate',candidate:{candidate:'',sdpMLineIndex:-1}},{type:'candidate',candidate:{candidate:'',sdpMid:4}}].map(signal=>({type:'voiceSignal',to:'peer',session:1,targetSession:1,signal})),
 ])expect(()=>validateMessage(invalid)).toThrow();
 expect(()=>validateMessage({type:'voiceSignal',to:'peer',session:1,targetSession:1,signal:{type:'candidate',candidate:{candidate:''}}})).not.toThrow();
});

it('exchanges open-room signaling in lobby and playing without readiness and retains channels through start',()=>{
 const f=fixture();f.voice('p0');f.voice('p1');
 expect(f.peers('p0')).toEqual([{id:'p0',seat:0,name:'Host',channel:'open',muted:false,session:1},{id:'p1',seat:1,name:'P1',channel:'open',muted:false,session:1}]);
 f.send('p0',{type:'voiceSignal',from:'p1',to:'p1',session:1,targetSession:1,signal:offer});expect(f.received('p1')).toEqual([{type:'voiceSignal',from:'p0',session:1,targetSession:1,signal:offer}]);
 f.start();expect(f.service.rooms.get(f.code)?.phase).toBe('playing');f.signal('p1','p0',1,1,candidate);expect(f.received('p0')).toEqual([{type:'voiceSignal',from:'p1',session:1,targetSession:1,signal:candidate}]);
});

it('allows everyone in team mode to select the open channel and limits private 2v4 channels to actual allies',()=>{
 const f=fixture('teams',6);for(let i=0;i<6;i++)f.send('p0',{type:'team',seat:i,team:i<2?0:1});
 for(let i=0;i<6;i++)f.voice(`p${i}`);
 expect(f.peers('p0')?.map(p=>p.id)).toEqual(['p0','p1','p2','p3','p4','p5']);f.signal('p0','p5');expect(f.received('p5')).toHaveLength(1);
 for(let i=0;i<6;i++)f.voice(`p${i}`,'team',2);
 expect(f.peers('p0')?.map(p=>p.id)).toEqual(['p0','p1']);expect(f.peers('p2')?.map(p=>p.id)).toEqual(['p2','p3','p4','p5']);
 f.signal('p0','p2',2,2);expect(f.received('p2')).toHaveLength(0);f.signal('p2','p5',2,2);expect(f.received('p5')).toHaveLength(2);
 f.voice('p1','open',3);f.signal('p0','p1',2,3);expect(f.received('p1')).toHaveLength(0);expect(f.peers('p0')?.map(p=>p.id)).toEqual(['p0']);
 f.start();f.signal('p3','p4',2,2);expect(f.received('p4')).toHaveLength(1);
});

it('rejects team voice in free-for-all and signaling for unjoined, queued, cross-room, self, or opted-out peers',()=>{
 const f=fixture();f.voice('p0','team');expect(f.sent.p0.at(-1)?.type).toBe('error');f.voice('p0');
 f.signal('p0','p1');expect(f.received('p1')).toHaveLength(0);f.voice('p1');
 f.connect('outsider');f.voice('outsider');expect(f.sent.outsider.at(-1)?.type).toBe('error');f.send('outsider',{type:'queue',name:'Outsider',count:8});f.voice('outsider');expect(f.sent.outsider.at(-1)?.type).toBe('error');
 f.signal('outsider','p0');expect(f.received('p0')).toHaveLength(0);f.signal('p0','p0');expect(f.received('p0')).toHaveLength(0);
 f.connect('other');f.send('other',{...create,name:'Other'});f.voice('other');f.signal('p0','other');f.signal('other','p0');expect(f.received('other')).toHaveLength(0);expect(f.received('p0')).toHaveLength(0);
 f.voice('p1',null,2);f.signal('p0','p1');expect(f.received('p1')).toHaveLength(0);expect(f.peers('p0')?.map(p=>p.id)).toEqual(['p0']);expect(f.peers('p1')).toEqual([]);
});

it('keeps mute updates in the current session and rejects stale sender, target, or channel epochs',()=>{
 const f=fixture('teams');f.voice('p0');f.voice('p1');f.voice('p0','open',1,true);expect(f.peers('p1')?.find(p=>p.id==='p0')?.muted).toBe(true);
 f.voice('p0','team',1);expect(f.sent.p0.at(-1)?.type).toBe('error');f.signal('p0','p1');expect(f.received('p1')).toHaveLength(1);
 f.voice('p0',null,2);f.voice('p0','open',3);f.signal('p0','p1',1,1);f.signal('p1','p0',1,1);expect(f.received('p1')).toHaveLength(1);expect(f.received('p0')).toHaveLength(0);
 expect(f.sent.p0.filter(m=>m.type==='voicePeers').at(-1)).toMatchObject({session:3});
 f.voice('p0','open',2);expect(f.sent.p0.at(-1)?.type).toBe('error');f.signal('p1','p0',1,3);expect(f.received('p0')).toHaveLength(1);
});

it('resets membership on team and mode changes but not readiness or ordinary settings updates',()=>{
 const f=fixture('teams');f.voice('p0');f.voice('p1');f.send('p1',{type:'ready',ready:true});expect(f.peers('p0')).toHaveLength(2);
 f.send('p0',{...create,type:'settings',mode:'teams',seed:77});expect(f.peers('p0')).toHaveLength(2);
 f.send('p0',{type:'team',seat:1,team:0});expect(f.peers('p0')).toEqual([]);expect(f.peers('p1')).toEqual([]);f.signal('p0','p1');expect(f.received('p1')).toHaveLength(0);
 f.voice('p0','open',1);expect(f.sent.p0.at(-1)?.type).toBe('error');f.voice('p0','team',2);f.voice('p1','team',2);expect(f.peers('p0')).toHaveLength(2);
 f.send('p0',{...create,type:'settings',mode:'ffa'});expect(f.peers('p0')).toEqual([]);f.signal('p0','p1',2,2);expect(f.received('p1')).toHaveLength(0);f.voice('p0','team',3);expect(f.sent.p0.at(-1)?.type).toBe('error');
});

it('removes departed lobby members and publishes remaining seat changes without persisting voice data',()=>{
 const f=fixture('ffa',3);for(let i=0;i<3;i++)f.voice(`p${i}`);f.send('p0',{type:'leave'});
 expect(f.peers('p1')?.map(p=>[p.id,p.seat])).toEqual([['p1',0],['p2',1]]);expect(f.peers('p0')).toEqual([]);
 const room=f.service.rooms.get(f.code)!;expect(JSON.stringify(room)).not.toMatch(/voice|muted|session/);f.connect('new');f.send('new',{type:'join',name:'New',code:f.code});expect(f.peers('new')).toEqual([]);f.signal('p1','new');expect(f.received('new')).toHaveLength(0);
});

it('clears disconnected and replaced sockets while stable participant IDs survive reconnects',()=>{
 const f=fixture();f.voice('p0');f.voice('p1');f.start();f.connect('replacement');f.send('replacement',{type:'resume',code:f.code,token:f.token});expect(f.closed).toEqual(['p0']);expect(f.peers('p1')?.map(p=>p.id)).toEqual(['p1']);expect(f.peers('replacement')).toEqual([]);
 f.voice('replacement');expect(f.peers('p1')?.map(p=>p.id)).toEqual(['p0','p1']);f.signal('p1','p0');expect(f.received('replacement')).toHaveLength(1);f.signal('p0','p1');expect(f.received('p1')).toHaveLength(0);
 f.service.disconnect('p0');f.signal('replacement','p1');expect(f.received('p1')[0]).toMatchObject({from:'p0'});
 f.service.disconnect('replacement');expect(f.peers('p1')?.map(p=>p.id)).toEqual(['p1']);f.advance(51);f.signal('p1','p0');expect(f.received('replacement')).toHaveLength(1);
});

it('supports countdown and finished phases and clears membership when a countdown is cancelled',()=>{
 const f=fixture();f.connect('a');f.connect('b');f.send('a',{type:'queue',name:'A',count:2});f.send('b',{type:'queue',name:'B',count:2});f.voice('a');f.voice('b');f.signal('a','b');expect(f.received('b')).toHaveLength(1);
 f.send('a',{type:'cancel'});expect(f.peers('b')).toEqual([]);f.signal('b','a');expect(f.received('a')).toHaveLength(0);
 f.voice('p0');f.voice('p1');f.start();f.service.rooms.get(f.code)!.phase='finished';f.signal('p0','p1');expect(f.received('p1')).toHaveLength(1);f.service.shutdown();expect(f.peers('p0')).toEqual([]);expect(f.peers('p1')).toEqual([]);
});

it('keeps normal commands available during seven-peer ICE bursts while bounding voice floods',()=>{
 const f=fixture('ffa',8);for(let i=0;i<8;i++)f.voice(`p${i}`);
 for(let i=0;i<70;i++)f.signal('p0',`p${1+i%7}`,1,1,candidate);
 expect(Array.from({length:7},(_,i)=>f.received(`p${i+1}`).length).reduce((a,b)=>a+b,0)).toBe(70);
 f.send('p0',{type:'ready',ready:true});expect(f.service.rooms.get(f.code)!.players[0].ready).toBe(true);
 for(let i=0;i<70;i++)f.signal('p0','p1',1,1,candidate);expect(f.received('p1').length).toBeLessThan(80);expect(f.sent.p0.at(-1)?.type).toBe('error');
});
