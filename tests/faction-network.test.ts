import {expect,it,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {RoomService} from '../server/rooms';
import type {Room,DriverCallbacks} from '../server/rooms';
import {CheckpointStore} from '../server/persistence';
import {validateMessage} from '../server/validation';
import {createGame} from '../src/sim/world';
import {validFaction} from '../src/sim/factions';

const create={type:'create',name:'Host',capacity:8,fillAI:false,difficulty:'normal',seed:42};
function fixture(){
 let now=1000;const sent:Record<string,any[]>={},drivers:{room:Room;cb:DriverCallbacks;controllers:any[]}[]=[];
 const service=new RoomService({now:()=>now,countdownMs:10,reconnectMs:50,driver:(room,cb)=>{const d={room,cb,controllers:[] as any[]};drivers.push(d);return{submit(){},controller(...args){d.controllers.push(args);},stop(){},checkpoint(){}};}});
 const connect=(id:string)=>{sent[id]=[];service.connect(id,{send:m=>sent[id].push(m),close(){}});};
 const send=(id:string,m:unknown)=>service.handle(id,validateMessage(m));
 const readyStart=(ids:string[])=>{for(const id of ids)send(id,{type:'ready',ready:true});send(ids[0],{type:'start'});};
 return{service,sent,drivers,connect,send,readyStart,advance:(ms:number)=>{now+=ms;service.sweep();}};
}

it('validates faction choices on every entry path and removes forged target seats',()=>{
 for(const message of [{...create,faction:'ravana'},{type:'join',code:'ABC234',name:'Guest',faction:'jaffna'},{type:'queue',name:'Guest',count:2,faction:'british'},{type:'faction',faction:'kandy',seat:1}]){
  const validated=validateMessage(message);expect(validated).toMatchObject({faction:message.faction});expect(validated).not.toHaveProperty('seat');
 }
 for(const faction of ['unknown','__proto__','constructor',null,23,{}])for(const message of [{...create,faction},{type:'join',code:'ABC234',name:'Guest',faction},{type:'queue',name:'Guest',count:2,faction},{type:'faction',faction}])expect(()=>validateMessage(message)).toThrow();
 expect(()=>validateMessage({type:'faction'})).toThrow();
});

it('lets each player change only their own faction, clears readiness and retains team voice',()=>{
 const f=fixture();for(const id of ['a','b'])f.connect(id);f.send('a',{...create,mode:'teams',faction:'anuradhapura'});const code=f.sent.a.find(m=>m.type==='joined').room.code;
 f.send('b',{type:'join',code,name:'Guest',faction:'jaffna'});f.send('b',{type:'team',team:0});
 for(const id of ['a','b']){f.send(id,{type:'voiceState',channel:'team',muted:false,session:1});f.send(id,{type:'ready',ready:true});}
 f.send('b',{type:'faction',faction:'ravana',seat:0});const room=f.service.rooms.get(code)!;
 expect(room.players.map(p=>(p as any).faction)).toEqual(['anuradhapura','ravana']);expect(room.players.every(p=>!p.ready)).toBe(true);
 expect(f.sent.a.filter(m=>m.type==='voicePeers').at(-1).peers.map((p:any)=>p.id)).toEqual(['a','b']);
 expect(f.sent.a.filter(m=>m.type==='room').at(-1).room.players[1].faction).toBe('ravana');
 f.send('b',{type:'team',team:1});f.readyStart(['a','b']);expect(f.drivers[0].room.config?.participants?.map(p=>(p as any).faction)).toEqual(['anuradhapura','ravana']);
 f.send('a',{type:'faction',faction:'dutch'});expect(f.sent.a.at(-1).type).toBe('error');expect((room.players[0] as any).faction).toBe('anuradhapura');
});

it('preserves unequal 2v4 teams and match options alongside independent factions',()=>{
 const f=fixture(),ids=Array.from({length:6},(_,i)=>`p${i}`),factions=['kandy','ravana','dutch','chola','elara','polonnaruwa'];
 ids.forEach(f.connect);f.send('p0',{...create,mode:'teams',zombies:true,mapType:'riverlands',mapSize:'huge',faction:factions[0]});const code=f.sent.p0.find(m=>m.type==='joined').room.code;
 for(let i=1;i<6;i++)f.send(ids[i],{type:'join',name:ids[i],code,faction:factions[i]});for(let i=0;i<6;i++)f.send('p0',{type:'team',seat:i,team:i<2?0:1});f.readyStart(ids);
 expect(f.drivers[0].room.config).toMatchObject({zombies:true,mapType:'riverlands',mapSize:'huge'});expect(f.drivers[0].room.config?.participants?.map(p=>({team:p.team,faction:(p as any).faction}))).toEqual(factions.map((faction,i)=>({team:i<2?0:1,faction})));
});

it('matches different factions together and retains individual choices after countdown cancellation',()=>{
 const f=fixture();for(const [id,faction] of [['a','anuradhapura'],['b','british'],['c','ravana']]){f.connect(id);f.send(id,{type:'queue',name:id,count:2,mode:'teams',zombies:true,mapType:'riverlands',mapSize:'huge',faction});}
 f.send('a',{type:'cancel'});f.advance(11);expect(f.drivers).toHaveLength(1);expect(f.drivers[0].room.config?.participants?.map(p=>({name:p.name,faction:(p as any).faction}))).toEqual([{name:'c',faction:'ravana'},{name:'b',faction:'british'}]);
 expect(f.drivers[0].room.config).toMatchObject({zombies:true,mapType:'riverlands',mapSize:'huge'});
});

it('gives filled AI seats deterministic explicit factions while preserving human choices',()=>{
 const f=fixture();for(const id of ['a','b'])f.connect(id);f.send('a',{...create,fillAI:true,faction:'ravana'});const code=f.sent.a.find(m=>m.type==='joined').room.code;f.send('b',{type:'join',name:'Guest',code,faction:'dutch'});f.readyStart(['a','b']);
 const participants=f.drivers[0].room.config!.participants!;expect(participants.slice(0,2).map(p=>p.faction)).toEqual(['ravana','dutch']);expect(participants.slice(2).every(p=>p.controller==='ai'&&validFaction(p.faction))).toBe(true);expect(new Set(participants.slice(2).map(p=>p.faction)).size).toBe(6);
});

it('keeps factions during reconnect, restored rooms and eventual AI takeover',()=>{
 const f=fixture();for(const id of ['a','b'])f.connect(id);f.send('a',{...create,faction:'ravana'});const joined=f.sent.a.find(m=>m.type==='joined');f.send('b',{type:'join',name:'Guest',code:joined.room.code});f.readyStart(['a','b']);
 const room=f.drivers[0].room;expect((room.players[1] as any).faction).toBe('anuradhapura');f.service.disconnect('a');f.connect('resumed');f.send('resumed',{type:'resume',code:room.code,token:joined.token});expect(f.sent.resumed.find(m=>m.type==='joined').room.players[0].faction).toBe('ravana');
 f.service.restore(room);f.connect('restored');f.send('restored',{type:'resume',code:room.code,token:joined.token});expect(f.sent.restored.find(m=>m.type==='joined').room.players[0].faction).toBe('ravana');
 f.service.disconnect('restored');f.advance(51);expect(room.players[0].controller).toBe('ai');expect((room.players[0] as any).faction).toBe('ravana');
});

it('roundtrips checkpoint factions, accepts neutral legacy seats and rejects invalid or conflicting metadata',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lanka-factions-')),error=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{
  const f=fixture();for(const id of ['a','b'])f.connect(id);f.send('a',{...create,faction:'ravana'});const code=f.sent.a.find(m=>m.type==='joined').room.code;f.send('b',{type:'join',name:'Guest',code,faction:'jaffna'});f.readyStart(['a','b']);
  const room=f.drivers[0].room;room.lastState=createGame(room.config!);const store=new CheckpointStore(dir);await store.init();store.save(room);await store.flush();
  const path=join(dir,`${code}.json`),saved=JSON.parse(await readFile(path,'utf8'));expect((await store.load())[0].players.map(p=>(p as any).faction)).toEqual(['ravana','jaffna']);
  for(const faction of ['unknown','constructor','anuradhapura']){const damaged=structuredClone(saved);damaged.room.players[0].faction=faction;await writeFile(path,JSON.stringify(damaged));expect(await store.load()).toHaveLength(0);}
  for(const faction of ['unknown','kandy']){const damaged=structuredClone(saved);damaged.room.config.participants[0].faction=faction;await writeFile(path,JSON.stringify(damaged));expect(await store.load()).toHaveLength(0);}
  for(const p of saved.room.players)delete p.faction;for(const p of saved.room.lastState.players)delete p.faction;for(const p of saved.room.config.participants)delete p.faction;for(const p of saved.room.lastState.config.participants)delete p.faction;
  await writeFile(path,JSON.stringify(saved));expect((await store.load())[0].players.every(p=>(p as any).faction===undefined)).toBe(true);
 }finally{error.mockRestore();await rm(dir,{recursive:true,force:true});}
});
