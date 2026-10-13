import {WebSocket} from 'ws';
import {startServer} from '../server/index';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await startServer({port:0,dataDir:false,countdownMs:100});
const clients:WebSocket[]=[],bytes:number[]=Array(8).fill(0),snapshots:number[]=Array(8).fill(0),ticks:number[]=Array(8).fill(0);
try{
 for(let i=0;i<8;i++){const socket=new WebSocket(`ws://127.0.0.1:${server.port}/ws`);clients.push(socket);socket.on('message',b=>{bytes[i]+=Buffer.byteLength(b.toString());const m=JSON.parse(b.toString());if(m.type==='snapshot'){snapshots[i]++;ticks[i]=m.snapshot.tick;}});await new Promise<void>((resolve,reject)=>{socket.once('open',()=>resolve());socket.once('error',reject);});socket.send(JSON.stringify({type:'queue',count:8,name:`Benchmark ${i+1}`}));}
 const start=performance.now();await new Promise(r=>setTimeout(r,5000));const seconds=(performance.now()-start)/1000;
 const report={humanConnections:8,seconds,bytesTotal:bytes.reduce((a,b)=>a+b,0),kilobytesPerSecondPerPlayer:bytes.map(b=>Math.round(b/1024/seconds*100)/100),snapshotsPerPlayer:snapshots,lastTicks:ticks,fixture:'Eight real connections and starting economies; initial terrain/fog plus subsequent fog deltas. Separate 800-unit simulation/render benchmarks measure troop load.'};
 await mkdir('test-results',{recursive:true});await writeFile('test-results/network-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(snapshots.some(n=>n<15))process.exitCode=1;
}finally{clients.forEach(c=>c.close());await server.close();}
