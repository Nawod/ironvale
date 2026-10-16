import {expect,it} from 'vitest';
import {RoomService,type Room} from '../server/rooms';
import {validateMessage} from '../server/validation';

const settings={capacity:8,fillAI:false,difficulty:'normal',seed:42};
function fixture(){
 let now=0;const sent:Record<string,any[]>={},starts:Room[]=[];
 const service=new RoomService({now:()=>now,countdownMs:10,driver:room=>{starts.push(room);return{submit(){},controller(){},stop(){},checkpoint(){}};}});
 const connect=(id:string)=>{sent[id]=[];service.connect(id,{send:m=>sent[id].push(m),close(){}});};
 const send=(id:string,message:unknown)=>service.handle(id,validateMessage(message));
 const queue=(id:string,mapType?:string,zombies=false)=>{connect(id);send(id,{type:'queue',name:id,count:2,mapType,zombies});};
 return{service,sent,starts,connect,send,queue,advance:()=>{now+=11;service.sweep();}};
}

it.each(['create','settings','queue'])('accepts only supported map values in %s messages',type=>{
 const base={type,name:'Host',count:2,...settings};
 for(const mapType of ['lowlands','riverlands'])expect(validateMessage({...base,mapType})).toMatchObject({mapType});
 for(const mapType of ['ocean','Riverlands','',null,3,{},true])expect(()=>validateMessage({...base,mapType})).toThrow();
 expect(validateMessage(base)).not.toHaveProperty('mapType');
});

it('separates public maps while matching legacy omitted maps with explicit Lowlands',()=>{
 const f=fixture();f.queue('river','riverlands');f.queue('legacy');f.advance();expect(f.starts).toHaveLength(0);
 f.queue('low','lowlands');f.advance();expect(f.starts).toHaveLength(1);
 expect(f.starts[0].config).toMatchObject({mapType:'lowlands',participants:[{name:'legacy'},{name:'low'}]});
 f.queue('river2','riverlands');f.advance();expect(f.starts).toHaveLength(2);expect(f.starts[1].config).toMatchObject({mapType:'riverlands'});
});

it.each([false,true])('retains Riverlands after a public countdown is cancelled and rematched (zombies=%s)',zombies=>{
 const f=fixture();f.queue('low','lowlands',zombies);f.queue('a','riverlands',zombies);f.queue('b','riverlands',zombies);f.queue('c','riverlands',zombies);
 f.send('a',{type:'cancel'});f.advance();expect(f.starts).toHaveLength(1);
 expect(f.starts[0].config).toMatchObject({mapType:'riverlands',zombies,participants:[{name:'c'},{name:'b'}]});
 expect(f.sent.low.at(-1)).toMatchObject({type:'queued',waiting:1});
});

it('keeps the host map in room updates, authoritative start, and resumed seats',()=>{
 const f=fixture();f.connect('host');f.connect('friend');f.send('host',{type:'create',name:'Host',...settings,mapType:'riverlands'});
 const joined=f.sent.host.find(m=>m.type==='joined');expect(joined.room.mapType).toBe('riverlands');
 f.send('friend',{type:'join',name:'Friend',code:joined.room.code});
 f.send('friend',{type:'settings',...settings,mapType:'lowlands'});expect(f.sent.friend.at(-1).type).toBe('error');
 f.send('host',{type:'settings',...settings,difficulty:'hard',zombies:true});
 expect(f.sent.friend.at(-1).room).toMatchObject({mapType:'riverlands',difficulty:'hard',zombies:true});
 for(const id of ['host','friend'])f.send(id,{type:'ready',ready:true});f.send('host',{type:'start'});
 expect(f.starts[0].config).toMatchObject({mapType:'riverlands',difficulty:'hard',zombies:true});
 f.service.disconnect('host');f.connect('resumed');f.send('resumed',{type:'resume',code:joined.room.code,token:joined.token});
 expect(f.sent.resumed.find(m=>m.type==='started').room.mapType).toBe('riverlands');
});

it('defaults a legacy private start to Lowlands and permits the host to change maps before starting',()=>{
 const f=fixture();f.connect('host');f.send('host',{type:'create',name:'Host',...settings});
 const code=f.sent.host.find(m=>m.type==='joined').room.code;expect(f.sent.host.at(-1).room.mapType).toBe('lowlands');
 f.connect('friend');f.send('friend',{type:'join',name:'Friend',code});
 f.send('friend',{type:'ready',ready:true});f.send('host',{type:'settings',...settings,mapType:'riverlands'});
 expect(f.sent.friend.at(-1).room.players.every((p:any)=>!p.ready)).toBe(true);
 f.send('host',{type:'settings',...settings,mapType:'lowlands'});
 for(const id of ['host','friend'])f.send(id,{type:'ready',ready:true});f.send('host',{type:'start'});
 expect(f.starts[0].config).toMatchObject({mapType:'lowlands'});
});
