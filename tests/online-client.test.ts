import {it,expect,vi,afterEach} from 'vitest';
import {OnlineSession} from '../src/net/online';
import type {RoomView} from '../src/net/protocol';
class FakeSocket {static OPEN=1;static CONNECTING=0;static instances:FakeSocket[]=[];readyState=0;onopen?:()=>void;onclose?:(e:any)=>void;onmessage?:(e:any)=>void;onerror?:()=>void;sent:any[]=[];constructor(){FakeSocket.instances.push(this);}send(m:string){this.sent.push(JSON.parse(m));}close(){}open(){this.readyState=1;this.onopen?.();}receive(data:any){this.onmessage?.({data:JSON.stringify(data)});}}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();FakeSocket.instances=[];});
it('clears an expired reconnect credential and offers a fresh lobby instead of stale ownership',()=>{
 const values=new Map([['ironvale-online-seat',JSON.stringify({code:'ABC234',token:'a'.repeat(64)})]]);
 vi.stubGlobal('sessionStorage',{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});vi.stubGlobal('location',{href:'http://localhost/',protocol:'http:'});vi.stubGlobal('WebSocket',FakeSocket);
 const client=new OnlineSession();client.restore();const socket=FakeSocket.instances[0];socket.open();socket.receive({type:'room',room:{code:'ABC234',phase:'playing'}});socket.receive({type:'error',error:'This seat can no longer be reconnected.'});expect(values.has('ironvale-online-seat')).toBe(false);expect(client.state.room).toBeUndefined();expect(client.state.error).toContain('reconnected');client.terminate();
});

function lobby(){
 vi.stubGlobal('sessionStorage',{getItem:()=>null,setItem:()=>{},removeItem:()=>{}});vi.stubGlobal('location',{href:'http://localhost/',protocol:'http:'});vi.stubGlobal('WebSocket',FakeSocket);
 const room:RoomView={code:'ABC234',kind:'private',phase:'lobby',hostId:'host',capacity:8,fillAI:false,difficulty:'normal',seed:42,mode:'ffa',mapType:'riverlands',zombies:false,players:[{id:'host',seat:0,name:'Host',ready:false,connected:true,controller:'human'}]},client=new OnlineSession();
 client.send({type:'create',name:'Host',...room});const socket=FakeSocket.instances[0];socket.open();socket.receive({type:'welcome',id:'host',protocol:1});socket.receive({type:'joined',room,playerId:0,lastSeq:0,token:'a'.repeat(64)});return{client,socket,room};
}
it('keeps rapid host edits visible and composes them while older setting replies arrive',()=>{
 const {client,socket,room}=lobby();try{
  client.updateSettings({mapType:'lowlands'});client.updateSettings({mapType:'riverlands'});client.updateSettings({zombies:true});expect(client.state.room).toMatchObject({mapType:'riverlands',zombies:true});expect(socket.sent.at(-1)).toMatchObject({type:'settings',mapType:'riverlands',zombies:true});
  socket.receive({type:'room',room:{...room,mapType:'lowlands'}});expect(client.state.room).toMatchObject({mapType:'riverlands',zombies:true});client.updateSettings({fillAI:true});expect(socket.sent.at(-1)).toMatchObject({mapType:'riverlands',zombies:true,fillAI:true});
  socket.receive({type:'room',room});socket.receive({type:'room',room:{...room,zombies:true}});socket.receive({type:'room',room:{...room,zombies:true,fillAI:true}});expect(client.state.room).toMatchObject({mapType:'riverlands',zombies:true,fillAI:true});
  socket.receive({type:'room',room:{...room,mapType:'lowlands'}});expect(client.state.room).toMatchObject({mapType:'lowlands',zombies:false,fillAI:false});
 }finally{client.terminate();}
});
it('rolls rejected settings back to the last confirmed server room',()=>{
 const {client,socket,room}=lobby();try{client.updateSettings({zombies:true});socket.receive({type:'error',error:'Only the host can change settings.'});expect(client.state.room).toEqual(room);client.updateSettings({mapType:'lowlands'});expect(socket.sent.at(-1)).toMatchObject({mapType:'lowlands',zombies:false});}finally{client.terminate();}
});
it('clears pending settings across leave and reconnect without queueing stale edits',()=>{
 const {client,socket,room}=lobby();try{client.updateSettings({zombies:true});socket.readyState=3;socket.onclose?.({code:1006});const sent=socket.sent.length;client.updateSettings({fillAI:true});expect(socket.sent).toHaveLength(sent);expect(client.state.room).toEqual(room);client.leave();expect(client.state.room).toBeUndefined();}finally{client.terminate();}
});
it('only lets the connected room host issue lobby setting updates',()=>{
 const {client,socket}=lobby();try{client.state.id='guest';const sent=socket.sent.length;client.updateSettings({zombies:true});expect(socket.sent).toHaveLength(sent);expect(client.state.room?.zombies).toBe(false);}finally{client.terminate();}
});
it('does not mistake an older identical room for confirmation of the latest rapid edit',()=>{
 const {client,socket,room}=lobby();try{
  client.updateSettings({mapType:'lowlands'});client.updateSettings({mapType:'riverlands'});socket.receive({type:'room',room});socket.receive({type:'room',room:{...room,mapType:'lowlands'}});
  expect(client.state.room?.mapType).toBe('riverlands');client.updateSettings({zombies:true});expect(socket.sent.at(-1)).toMatchObject({mapType:'riverlands',zombies:true});
  socket.receive({type:'room',room});expect(client.state.room).toMatchObject({mapType:'riverlands',zombies:true});socket.receive({type:'room',room:{...room,zombies:true}});expect(client.state.room).toMatchObject({mapType:'riverlands',zombies:true});
 }finally{client.terminate();}
});
it('correlates overlapping command replies independently without putting internal request IDs on the wire',()=>{
 const{client,socket}=lobby(),received:any[]=[];client.onmessage=e=>received.push(e.data);
 try{
  client.postMessage({type:'command',requestId:81,command:{type:'buildWallLine',player:0,workers:[5],building:'palisade',start:{x:24,y:24},end:{x:26,y:24}}});
  client.postMessage({type:'command',requestId:82,command:{type:'order',player:0,ids:[5],order:{kind:'idle'}}});
  const commands=socket.sent.filter(m=>m.type==='command');expect(commands).toHaveLength(2);expect(commands.every(m=>m.requestId===undefined&&m.command.requestId===undefined)).toBe(true);
  socket.receive({type:'commandResult',seq:commands[1].seq,error:null});socket.receive({type:'commandResult',seq:commands[0].seq,error:'Not enough resources.'});
  expect(received).toEqual([{type:'commandResult',seq:commands[1].seq,requestId:82,error:null},{type:'commandResult',seq:commands[0].seq,requestId:81,error:'Not enough resources.'}]);
 }finally{client.terminate();}
});
it.each(['close','closed','left','leave','terminate'])('fails each unanswered command once on %s without replaying or confusing later replies',reason=>{
 const{client,socket,room}=lobby(),received:any[]=[];client.onmessage=e=>received.push(e.data);
 client.postMessage({type:'command',requestId:91,command:{type:'order',player:0,ids:[5],order:{kind:'idle'}}});client.postMessage({type:'command',requestId:92,command:{type:'order',player:0,ids:[6],order:{kind:'idle'}}});
 const sent=socket.sent.filter(m=>m.type==='command');socket.receive({type:'commandResult',seq:sent[0].seq,error:null});
 if(reason==='close'){socket.readyState=3;socket.onclose?.({code:1006});}else if(reason==='leave')client.leave();else if(reason==='terminate')client.terminate();else socket.receive({type:reason,error:'The match is closed.'});
 const failures=received.filter(m=>m.type==='commandResult'&&m.error);expect(failures).toHaveLength(1);expect(failures[0]).toMatchObject({requestId:92,seq:sent[1].seq});expect(failures[0].error).toEqual(expect.any(String));
 client.terminate();expect(received.filter(m=>m.type==='commandResult'&&m.requestId===92)).toHaveLength(1);
 if(reason!=='terminate'){socket.receive({type:'joined',room,playerId:0,lastSeq:0,token:'a'.repeat(64)});expect(socket.sent.filter(m=>m.type==='command')).toHaveLength(2);}
});
it('returns a correlated reconnect rejection immediately and leaves unrelated server errors uncorrelated',()=>{
 const{client,socket}=lobby(),received:any[]=[];client.onmessage=e=>received.push(e.data);
 try{client.postMessage({type:'command',requestId:101,command:{type:'order',player:0,ids:[5],order:{kind:'idle'}}});socket.receive({type:'error',error:'Voice channel unavailable.'});expect(received.at(-1)).toEqual({type:'error',error:'Voice channel unavailable.'});
  socket.receive({type:'commandResult',seq:1,error:null});expect(received.at(-1)).toMatchObject({requestId:101,error:null});socket.readyState=3;client.postMessage({type:'command',requestId:102,command:{type:'order',player:0,ids:[5],order:{kind:'idle'}}});expect(received.at(-1)).toMatchObject({type:'commandResult',requestId:102,error:expect.stringMatching(/reconnecting/i)});
 }finally{client.terminate();}
});
it('keeps legacy command callbacks unchanged when no request ID is supplied',()=>{
 const{client,socket}=lobby(),received:any[]=[];client.onmessage=e=>received.push(e.data);try{client.postMessage({type:'command',command:{type:'order',player:0,ids:[5],order:{kind:'idle'}}});socket.receive({type:'commandResult',seq:1,error:null});expect(received).toEqual([{type:'commandResult',seq:1,error:null}]);}finally{client.terminate();}
});
it('reconnects without replaying an unconfirmed purchase and binds fresh requests to the resumed sequence',async()=>{
 vi.useFakeTimers();const{client,socket,room}=lobby(),received:any[]=[];client.onmessage=e=>received.push(e.data);
 try{
  const purchase={type:'buildWallLine' as const,player:0,workers:[5],building:'palisade' as const,start:{x:24,y:24},end:{x:26,y:24}};
  client.postMessage({type:'command',requestId:111,command:purchase});socket.readyState=3;socket.onclose?.({code:1006});expect(received.at(-1)).toMatchObject({requestId:111,error:expect.any(String)});
  await vi.advanceTimersByTimeAsync(500);const resumed=FakeSocket.instances[1];resumed.open();expect(resumed.sent).toEqual([{type:'resume',code:room.code,token:'a'.repeat(64)}]);resumed.receive({type:'joined',room:{...room,phase:'playing'},playerId:0,lastSeq:17,token:'a'.repeat(64)});
  client.postMessage({type:'command',requestId:112,command:{type:'order',player:0,ids:[5],order:{kind:'idle'}}});expect(resumed.sent.at(-1)).toMatchObject({type:'command',seq:18});expect(resumed.sent.filter(m=>m.type==='command'&&m.command.type==='buildWallLine')).toHaveLength(0);
  socket.receive({type:'commandResult',seq:1,error:null});expect(received.filter(m=>m.requestId===111)).toHaveLength(1);resumed.receive({type:'commandResult',seq:18,error:null});expect(received.at(-1)).toMatchObject({requestId:112,error:null});
 }finally{client.terminate();}
});
it('rejects a thrown send with the correct ID without retaining or replaying it',()=>{
 const{client,socket}=lobby(),received:any[]=[];client.onmessage=e=>received.push(e.data);try{socket.send=()=>{throw new Error('Socket closed during send.');};client.postMessage({type:'command',requestId:121,command:{type:'order',player:0,ids:[5],order:{kind:'idle'}}});expect(received).toEqual([{type:'commandResult',seq:1,requestId:121,error:expect.stringMatching(/could not be sent/i)}]);}finally{client.terminate();}expect(received).toHaveLength(1);
});
