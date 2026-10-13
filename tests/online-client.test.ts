import {it,expect,vi,afterEach} from 'vitest';
import {OnlineSession} from '../src/net/online';
class FakeSocket {static OPEN=1;static CONNECTING=0;static instances:FakeSocket[]=[];readyState=0;onopen?:()=>void;onclose?:(e:any)=>void;onmessage?:(e:any)=>void;onerror?:()=>void;sent:any[]=[];constructor(){FakeSocket.instances.push(this);}send(m:string){this.sent.push(JSON.parse(m));}close(){}open(){this.readyState=1;this.onopen?.();}receive(data:any){this.onmessage?.({data:JSON.stringify(data)});}}
afterEach(()=>{vi.unstubAllGlobals();FakeSocket.instances=[];});
it('clears an expired reconnect credential and offers a fresh lobby instead of stale ownership',()=>{
 const values=new Map([['ironvale-online-seat',JSON.stringify({code:'ABC234',token:'a'.repeat(64)})]]);
 vi.stubGlobal('sessionStorage',{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});vi.stubGlobal('location',{href:'http://localhost/',protocol:'http:'});vi.stubGlobal('WebSocket',FakeSocket);
 const client=new OnlineSession();client.restore();const socket=FakeSocket.instances[0];socket.open();socket.receive({type:'room',room:{code:'ABC234',phase:'playing'}});socket.receive({type:'error',error:'This seat can no longer be reconnected.'});expect(values.has('ironvale-online-seat')).toBe(false);expect(client.state.room).toBeUndefined();expect(client.state.error).toContain('reconnected');client.terminate();
});
