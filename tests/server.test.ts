import {it,expect} from 'vitest';
import {WebSocket} from 'ws';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {startServer} from '../server/index';
async function client(port:number){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),messages:any[]=[];ws.on('message',b=>messages.push(JSON.parse(b.toString())));await new Promise<void>((res,rej)=>{ws.on('open',()=>res());ws.on('error',rej);});return{ws,messages,send:(m:any)=>ws.send(JSON.stringify(m)),wait:async(type:string,predicate=(m:any)=>true)=>{let value:any;await expect.poll(()=>{value=messages.find(m=>m.type===type&&predicate(m));return!!value;},{timeout:10000}).toBe(true);return value;}};}
it('serves bundled models and photos with usable types and revalidates assets with stable filenames',async()=>{
 const server=await startServer({port:0,dataDir:false,staticDir:resolve('public')});try{
  for(const [path,type]of [['/models/deer.glb','model/gltf-binary'],['/models/materials/bark_diff.jpg','image/jpeg'],['/models/materials/twig_alpha.png','image/png']]){
   const response=await fetch(`http://127.0.0.1:${server.port}${path}`,{method:'HEAD'});expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe(type);expect(response.headers.get('x-content-type-options')).toBe('nosniff');expect(response.headers.get('cache-control')).toBe('no-cache');
  }
 }finally{await server.close();}
});
it('runs a real two-player private match only after host start and accepts orders for both seats',async()=>{
 const server=await startServer({port:0,dataDir:false}),a=await client(server.port),b=await client(server.port);
 try{a.send({type:'create',name:'Alice',capacity:2,fillAI:false,difficulty:'normal',seed:42});const joined=await a.wait('joined');b.send({type:'join',name:'Bob',code:joined.room.code});await b.wait('joined');a.send({type:'ready',ready:true});b.send({type:'ready',ready:true});await new Promise(r=>setTimeout(r,200));expect(a.messages.some(m=>m.type==='started')).toBe(false);a.send({type:'start'});
  const av=(await a.wait('snapshot')).snapshot,bv=(await b.wait('snapshot')).snapshot;expect(av.playerId).toBe(0);expect(bv.playerId).toBe(1);expect(av.players[1].resources.food).toBe(0);expect(bv.players[0].resources.food).toBe(0);expect(bv.entities.some((e:any)=>e.owner===0&&e.kind==='unit')).toBe(false);
  b.send({type:'command',seq:1,command:{type:'recruit',player:0,building:bv.players[1].capital,unit:'villager'}});expect((await b.wait('commandResult')).error).toBeNull();b.send({type:'command',seq:2,command:{type:'recruit',building:av.players[0].capital,unit:'villager'}});expect((await b.wait('commandResult',m=>m.seq===2)).error).toBeTruthy();
  b.send({type:'command',seq:3,command:{type:'order',ids:'invalid',order:{kind:'idle'}}});await b.wait('error');expect((await fetch(`http://127.0.0.1:${server.port}/health`)).status).toBe(200);
 }finally{a.ws.close();b.ws.close();await server.close();}
});
it.each([2,3,4,5,6,7,8])('public matchmaking starts exactly %i humans',async count=>{const server=await startServer({port:0,dataDir:false,countdownMs:10}),clients=[];try{for(let i=0;i<count;i++){const c=await client(server.port);clients.push(c);c.send({type:'queue',count,name:`Player ${i}`});}for(const [i,c]of clients.entries()){const start=await c.wait('started');expect(start.playerId).toBe(i);expect(start.room.players).toHaveLength(count);expect(start.room.players.every((p:any)=>p.controller==='human')).toBe(true);await c.wait('snapshot');}}finally{clients.forEach(c=>c.ws.close());await server.close();}});
it('recovers a checkpoint and reconnects a guest without leaking its credential',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ironvale-'));let server=await startServer({port:0,dataDir:dir}),a=await client(server.port),b=await client(server.port);
 try{a.send({type:'create',name:'Alice',capacity:2,fillAI:false,difficulty:'normal',seed:4});const joined=await a.wait('joined');b.send({type:'join',code:joined.room.code,name:'Bob'});await b.wait('joined');a.send({type:'ready',ready:true});b.send({type:'ready',ready:true});await a.wait('room',m=>m.room.players.length===2&&m.room.players.every((p:any)=>p.ready));a.send({type:'start'});const v=(await a.wait('snapshot')).snapshot;
  a.send({type:'command',seq:1,command:{type:'recruit',building:v.players[0].capital,unit:'villager'}});await a.wait('commandResult');expect(JSON.stringify(b.messages)).not.toContain(joined.token);await server.close();a.ws.close();b.ws.close();
  server=await startServer({port:0,dataDir:dir});a=await client(server.port);a.send({type:'resume',code:joined.room.code,token:joined.token});expect((await a.wait('joined')).lastSeq).toBe(1);const restored=(await a.wait('snapshot')).snapshot;expect(restored.players[0].resources.food).toBe(300);expect(restored.tick).toBeGreaterThanOrEqual(v.tick);
 }finally{a.ws.close();b.ws.close();await server.close();await rm(dir,{recursive:true,force:true});}
});
