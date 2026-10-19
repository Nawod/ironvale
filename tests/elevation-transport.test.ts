import {expect,it} from 'vitest';
import {WebSocket} from 'ws';
import {startServer} from '../server/index';

async function client(port:number){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`),messages:any[]=[];ws.on('message',b=>messages.push(JSON.parse(b.toString())));
 await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 return{ws,messages,send:(m:any)=>ws.send(JSON.stringify(m)),wait:async(type:string,predicate=(m:any)=>true)=>{let value:any;await expect.poll(()=>{value=messages.find(m=>m.type===type&&predicate(m));return!!value;},{timeout:10000}).toBe(true);return value;}};
}

// The worker supplies already masked, exact heights, just as the match worker does.
const workerURL=new URL('data:text/javascript,'+encodeURIComponent(`
 import {parentPort,workerData} from 'node:worker_threads';
 let tick=0;
 const publish=()=>{tick++;for(let player=0;player<2;player++){const fog=Array(256**2).fill(0),elevation=Array(257**2).fill(0);fog[0]=2;fog[1]=2;elevation[0]=0.3141592653589793;elevation[1]=0.5;if(tick>1){fog[3]=2;elevation[4]=1.1234567890123;}parentPort.postMessage({type:'snapshot',player,snapshot:{playerId:player,tick,size:256,terrain:Array(256**2).fill(0),fog,elevation,entities:[],players:[],events:[],winner:null,paused:false,config:workerData.config,population:0,capacity:0}});}};
 publish();setInterval(publish,100);
`));

it('sends exact elevation changes after the first packet and resets them when a seat reconnects',async()=>{
 const server=await startServer({port:0,dataDir:false,workerURL}),a=await client(server.port),b=await client(server.port);let resumed:Awaited<ReturnType<typeof client>>|undefined;
 try{
  a.send({type:'create',name:'Host',capacity:2,fillAI:false,difficulty:'normal',seed:42,mapSize:'huge'});const joined=await a.wait('joined');b.send({type:'join',name:'Guest',code:joined.room.code});await b.wait('joined');
  a.send({type:'ready',ready:true});b.send({type:'ready',ready:true});await a.wait('room',m=>m.room.players.length===2&&m.room.players.every((p:any)=>p.ready));a.send({type:'start'});
  const first=(await a.wait('snapshot')).snapshot,changed=(await a.wait('snapshot',m=>m.snapshot.tick===2)).snapshot,unchanged=(await a.wait('snapshot',m=>m.snapshot.tick===3)).snapshot;
  expect(first.elevation).toHaveLength(257**2);expect(first.elevation.slice(0,5)).toEqual([0.3141592653589793,0.5,0,0,0]);expect(first.elevation.at(-1)).toBe(0);expect(first.elevationChanges).toBeUndefined();
  expect(changed.elevation).toBeUndefined();expect(changed.elevationChanges).toEqual([4,1.1234567890123]);expect(changed.elevationChanges).not.toContain(257**2-1);
  expect(JSON.stringify(changed).length).toBeLessThan(1000);expect(JSON.stringify(first).length).toBeGreaterThan(250000);
  expect(unchanged.elevation).toBeUndefined();expect(unchanged.elevationChanges).toEqual([]);
  resumed=await client(server.port);resumed.send({type:'resume',code:joined.room.code,token:joined.token});const initial=(await resumed.wait('snapshot')).snapshot;
  expect(initial.terrain).toBeDefined();expect(initial.fog).toBeDefined();expect(initial.elevation).toHaveLength(257**2);expect(initial.elevation.slice(0,5)).toEqual([0.3141592653589793,0.5,0,0,1.1234567890123]);expect(initial.elevation.at(-1)).toBe(0);expect(initial.elevationChanges).toBeUndefined();
 }finally{a.ws.close();b.ws.close();resumed?.ws.close();for(const room of server.rooms.rooms.values())room.driver?.stop();await server.close();}
});
