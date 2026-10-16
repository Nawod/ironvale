import {expect,it} from 'vitest';
import {RoomService,type Room} from '../server/rooms';
import {validateCommand,validateMessage} from '../server/validation';

const settings={capacity:8,fillAI:false,difficulty:'normal',seed:42};
function fixture(){
 let now=0;const sent:Record<string,any[]>={},starts:Room[]=[];
 const service=new RoomService({now:()=>now,countdownMs:10,driver:room=>{starts.push(room);return{submit(){},controller(){},stop(){},checkpoint(){}};}});
 const connect=(id:string)=>{sent[id]=[];service.connect(id,{send:m=>sent[id].push(m),close(){}});};
 const send=(id:string,message:unknown)=>service.handle(id,validateMessage(message));
 const queue=(id:string,mapSize?:string)=>{connect(id);send(id,{type:'queue',name:id,count:2,mapType:'riverlands',mapSize});};
 return{service,sent,starts,connect,send,queue,advance:()=>{now+=11;service.sweep();}};
}

it.each(['create','settings','queue'])('validates supported map sizes in %s messages',type=>{
 const base={type,name:'Host',count:2,...settings};
 for(const mapSize of ['standard','large','huge'])expect(validateMessage({...base,mapSize})).toMatchObject({mapSize});
 for(const mapSize of ['small','Large','',null,256,{},true])expect(()=>validateMessage({...base,mapSize})).toThrow();
});

it('matches omitted public map sizes with Large and isolates Standard and Huge',()=>{
 const f=fixture();f.queue('standard','standard');f.queue('legacy');f.queue('huge','huge');f.advance();expect(f.starts).toHaveLength(0);
 f.queue('large','large');f.advance();expect(f.starts).toHaveLength(1);expect(f.starts[0].config).toMatchObject({mapSize:'large',worldGeneration:2,participants:[{name:'legacy'},{name:'large'}]});
 f.queue('standard2','standard');f.queue('huge2','huge');f.advance();expect(f.starts).toHaveLength(3);expect(f.starts.map(r=>r.config?.mapSize)).toEqual(['large','standard','huge']);
});

it('retains Huge through countdown cancellation and rematching',()=>{
 const f=fixture();f.queue('large','large');for(const id of ['a','b','c'])f.queue(id,'huge');f.send('a',{type:'cancel'});f.advance();
 expect(f.starts).toHaveLength(1);expect(f.starts[0].config).toMatchObject({mapSize:'huge',participants:[{name:'c'},{name:'b'}]});expect(f.sent.large.at(-1)).toMatchObject({type:'queued',waiting:1});
});

it('keeps the host size through unrelated edits, actual human counts, start, and reconnect',()=>{
 const f=fixture();f.connect('host');f.send('host',{type:'create',name:'Host',...settings,mapSize:'huge'});const joined=f.sent.host.find(m=>m.type==='joined');expect(joined.room.mapSize).toBe('huge');
 for(const id of ['friend','third']){f.connect(id);f.send(id,{type:'join',name:id,code:joined.room.code});}
 f.send('friend',{type:'settings',...settings,mapSize:'standard'});expect(f.sent.friend.at(-1).type).toBe('error');
 f.send('host',{type:'settings',...settings,difficulty:'hard'});expect(f.sent.third.at(-1).room).toMatchObject({mapSize:'huge',difficulty:'hard'});
 for(const id of ['host','friend','third'])f.send(id,{type:'ready',ready:true});f.send('host',{type:'start'});
 expect(f.starts[0].config).toMatchObject({mapSize:'huge',opponents:2,worldGeneration:2});expect(f.starts[0].capacity).toBe(3);
 f.service.disconnect('host');f.connect('resumed');f.send('resumed',{type:'resume',code:joined.room.code,token:joined.token});expect(f.sent.resumed.find(m=>m.type==='started').room.mapSize).toBe('huge');
});

it('defaults old private settings to Large and clears readiness after the host changes size',()=>{
 const f=fixture();f.connect('host');f.send('host',{type:'create',name:'Host',...settings});const room=f.sent.host.find(m=>m.type==='joined').room;expect(room.mapSize).toBe('large');
 f.connect('friend');f.send('friend',{type:'join',name:'Friend',code:room.code});f.send('friend',{type:'ready',ready:true});f.send('host',{type:'settings',...settings,mapSize:'standard'});
 expect(f.sent.friend.at(-1).room).toMatchObject({mapSize:'standard'});expect(f.sent.friend.at(-1).room.players.every((p:any)=>!p.ready)).toBe(true);
});

it('accepts coordinates across Huge maps while rejecting coordinates beyond 256',()=>{
 const move=(x:number,y:number)=>({type:'order',ids:[1],order:{kind:'move',point:{x,y}}});
 expect(validateCommand(move(255.5,256))).toMatchObject({order:{point:{x:255.5,y:256}}});
 for(const point of [[256.1,0],[0,257],[-1,0],[NaN,0],[0,Infinity]])expect(()=>validateCommand(move(point[0],point[1]))).toThrow();
});
