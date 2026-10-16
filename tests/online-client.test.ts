import {it,expect,vi,afterEach} from 'vitest';
import {OnlineSession} from '../src/net/online';
import type {RoomView} from '../src/net/protocol';
class FakeSocket {static OPEN=1;static CONNECTING=0;static instances:FakeSocket[]=[];readyState=0;onopen?:()=>void;onclose?:(e:any)=>void;onmessage?:(e:any)=>void;onerror?:()=>void;sent:any[]=[];constructor(){FakeSocket.instances.push(this);}send(m:string){this.sent.push(JSON.parse(m));}close(){}open(){this.readyState=1;this.onopen?.();}receive(data:any){this.onmessage?.({data:JSON.stringify(data)});}}
afterEach(()=>{vi.unstubAllGlobals();FakeSocket.instances=[];});
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
