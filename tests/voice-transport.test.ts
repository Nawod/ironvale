import {it,expect} from 'vitest';
import {WebSocket} from 'ws';
import {startServer} from '../server/index';
it('keeps the real socket open for allowed ICE bursts alongside normal lobby commands',async()=>{
 const server=await startServer({port:0,dataDir:false}),clients:WebSocket[]=[];
 async function connect(){const ws=new WebSocket(`ws://127.0.0.1:${server.port}/ws`),messages:any[]=[];clients.push(ws);ws.on('message',data=>messages.push(JSON.parse(String(data))));await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});return{ws,messages,send:(m:any)=>ws.send(JSON.stringify(m))};}
 try{const a=await connect(),b=await connect();a.send({type:'create',name:'A',capacity:2,fillAI:false,difficulty:'normal',seed:42});await expect.poll(()=>a.messages.some(m=>m.type==='joined')).toBe(true);const joined=a.messages.find(m=>m.type==='joined');b.send({type:'join',name:'B',code:joined.room.code});await expect.poll(()=>b.messages.some(m=>m.type==='joined')).toBe(true);const target=b.messages.find(m=>m.type==='joined').room.players.find((p:any)=>p.name==='B').id;
  for(const client of [a,b])client.send({type:'voiceState',session:1,channel:'open',muted:true});await expect.poll(()=>a.messages.some(m=>m.type==='voicePeers'&&m.peers.length===2)).toBe(true);
  for(let i=0;i<70;i++)a.send({type:'voiceSignal',session:1,targetSession:1,to:target,signal:{type:'candidate',candidate:{candidate:'candidate:1 1 udp 1 127.0.0.1 3000 typ host'}}});
  for(let i=0;i<31;i++)a.send({type:'ready',ready:true});a.send({type:'settings',capacity:8,fillAI:false,difficulty:'normal',seed:54321});
  await expect.poll(()=>server.rooms.rooms.get(joined.room.code)?.seed,{timeout:5000}).toBe(54321);expect(a.ws.readyState).toBe(WebSocket.OPEN);expect(b.messages.filter(m=>m.type==='voiceSignal')).toHaveLength(70);
 }finally{clients.forEach(ws=>ws.close());await server.close();}
});
