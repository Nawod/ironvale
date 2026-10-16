import {expect,it} from 'vitest';
import {WebSocket} from 'ws';
import {startServer} from '../server/index';
import {BUILDINGS} from '../src/sim/definitions';
import type {BuildingType,Snapshot} from '../src/sim/types';

async function connect(port:number){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),messages:any[]=[];ws.on('message',data=>messages.push(JSON.parse(data.toString())));await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});return{ws,messages,send:(message:unknown)=>ws.send(JSON.stringify(message)),wait:async(type:string,predicate=(m:any)=>true)=>{let found:any;await expect.poll(()=>{found=messages.find(m=>m.type===type&&predicate(m));return !!found;},{timeout:10000}).toBe(true);return found;}};}
function clearPair(v:Snapshot){const cap=v.entities.find(e=>e.id===v.players[v.playerId].capital)!;for(let y=cap.y-5;y<=cap.y+7;y++)for(let x=cap.x-5;x<=cap.x+7;x++){
 const free=(tx:number)=>v.fog[y*v.size+tx]===2&&v.terrain[y*v.size+tx]<3&&!v.entities.some(e=>e.kind==='building'?tx<e.x+BUILDINGS[e.type as BuildingType].size&&tx+1>e.x&&y<e.y+BUILDINGS[e.type as BuildingType].size&&y+1>e.y:e.kind==='resource'&&e.amount>0&&e.x>=tx&&e.x<tx+1&&e.y>=y&&e.y<y+1);
 if(free(x)&&free(x+1))return{start:{x,y},end:{x:x+1,y}};
 }throw new Error('No scouted wall pair near the starting town center.');}
it('builds an online guest wall line for their own city through the authoritative worker',async()=>{
 const server=await startServer({port:0,dataDir:false}),host=await connect(server.port),guest=await connect(server.port);
 try{
  host.send({type:'create',name:'Host',capacity:2,fillAI:false,difficulty:'normal',seed:42,mapType:'lowlands'});const joined=await host.wait('joined');guest.send({type:'join',name:'Guest',code:joined.room.code});await guest.wait('joined');host.send({type:'ready',ready:true});guest.send({type:'ready',ready:true});await host.wait('room',m=>m.room.players.length===2&&m.room.players.every((p:any)=>p.ready));host.send({type:'start'});
  const h=(await host.wait('snapshot')).snapshot as Snapshot,v=(await guest.wait('snapshot')).snapshot as Snapshot,worker=v.entities.find(e=>e.owner===1&&e.type==='villager')!,pair=clearPair(v);
  guest.send({type:'command',seq:1,command:{type:'buildWallLine',player:0,workers:[worker.id],building:'palisade',...pair}});expect((await guest.wait('commandResult',m=>m.seq===1)).error).toBeNull();
  const updated=(await guest.wait('snapshot',m=>m.snapshot.entities.filter((e:any)=>e.type==='palisade'&&e.owner===1).length===2)).snapshot as Snapshot;
  expect(updated.players[1].resources.wood).toBe(v.players[1].resources.wood-16);expect(updated.entities.filter(e=>e.type==='palisade').every(e=>e.owner===1)).toBe(true);
  guest.send({type:'command',seq:2,command:{type:'buildWallLine',player:0,workers:[h.entities.find(e=>e.owner===0&&e.type==='villager')!.id],building:'palisade',...pair}});expect((await guest.wait('commandResult',m=>m.seq===2)).error).toMatch(/villager/i);
  guest.send({type:'command',seq:3,command:{type:'buildWallLine',workers:[worker.id],building:'gate',...pair}});expect((await guest.wait('error')).error).toMatch(/invalid/i);
 }finally{host.ws.close();guest.ws.close();await server.close();}
});
