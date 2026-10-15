import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {RoomService} from './rooms';
import {WorkerDriver} from './driver';
import {CheckpointStore} from './persistence';
import {validateMessage} from './validation';
import type {ServerMessage} from '../src/net/protocol';
export interface ServerOptions {port?:number;host?:string;dataDir?:string|false;countdownMs?:number;reconnectMs?:number;maxRooms?:number;maxConnections?:number;publicOrigin?:string;workerURL?:URL;staticDir?:string}
export async function startServer(options:ServerOptions={}){
 const directory=options.dataDir===false?undefined:options.dataDir??resolve('server-data');const store=directory?new CheckpointStore(directory):undefined;await store?.init();
 const workerURL=options.workerURL??new URL(import.meta.url.endsWith('.ts')?'../dist-server/match-worker.mjs':'./match-worker.mjs',import.meta.url),root=resolve(options.staticDir??'dist');
 const rooms=new RoomService({countdownMs:options.countdownMs,reconnectMs:options.reconnectMs,maxRooms:options.maxRooms,driver:(room,cb)=>new WorkerDriver(room,cb,workerURL),persist:room=>store?.save(room),remove:code=>store?.remove(code)});
 for(const room of await store?.load()??[])rooms.restore(room);
 let shuttingDown=false;
 const http=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  if(req.url==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:!shuttingDown,rooms:rooms.rooms.size,protocol:1}));return;}
  if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405).end();return;}
  try{const pathname=decodeURIComponent(new URL(req.url??'/', 'http://localhost').pathname),file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}const info=await stat(file);if(!info.isFile()){res.writeHead(404).end();return;}const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.json':'application/json'};res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.setHeader('Content-Length',info.size);res.setHeader('Cache-Control',extname(file)==='.html'?'no-store':pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache');if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);}catch{res.writeHead(404).end('Not found');}
 });
 const ws=new WebSocketServer({noServer:true,maxPayload:16384,perMessageDeflate:false}),ips=new Map<string,number>();
 http.on('upgrade',(req,socket,head)=>{
  const origin=req.headers.origin;let allowed=true;try{if(origin)allowed=options.publicOrigin?origin===options.publicOrigin:new URL(origin).host===req.headers.host;}catch{allowed=false;}
  const ip=req.socket.remoteAddress??'unknown';if(shuttingDown||req.url!=='/ws'||!allowed||ws.clients.size>=(options.maxConnections??256)||(ips.get(ip)??0)>=64){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  ws.handleUpgrade(req,socket,head,c=>{ips.set(ip,(ips.get(ip)??0)+1);c.once('close',()=>ips.set(ip,Math.max(0,(ips.get(ip)??1)-1)));ws.emit('connection',c);});
 });
 let bytesSent=0;
 ws.on('connection',socket=>{
  const id=randomUUID();let alive=true,bucketAt=Date.now(),count=0,invalid=0;let previousFog:number[]|undefined,previousPlayer:number|undefined;
  const send=(m:ServerMessage)=>{
   if(socket.readyState!==WebSocket.OPEN)return;if(socket.bufferedAmount>4*1024*1024){socket.close(1013,'Connection too slow');return;}if(m.type==='snapshot'&&socket.bufferedAmount>512*1024)return;
   if(m.type==='started'){previousFog=undefined;previousPlayer=undefined;}
   let packet:any=m;
   if(m.type==='snapshot'){
    const s=m.snapshot,changes:number[]=[];if(previousPlayer!==s.playerId)previousFog=undefined;
    if(previousFog)for(let i=0;i<s.fog.length;i++)if(s.fog[i]!==previousFog[i])changes.push(i,s.fog[i]);
    const {terrain,fog,...rest}=s;packet={type:'snapshot',snapshot:{...rest,entities:rest.entities.map(e=>({...e,path:[],pathGoal:undefined,nextPathTick:undefined})),...(previousFog?{fogChanges:changes}:{terrain,fog})}};previousFog=[...fog];previousPlayer=s.playerId;
   }
   const text=JSON.stringify(packet);bytesSent+=Buffer.byteLength(text);socket.send(text);
  };
  rooms.connect(id,{send,close:()=>socket.close(4001,'This seat reconnected in another tab')});
  socket.on('pong',()=>alive=true);
  socket.on('message',data=>{
   if(Date.now()-bucketAt>=1000){bucketAt=Date.now();count=0;}if(++count>100){socket.close(1008,'Too many messages');return;}
   try{rooms.handle(id,validateMessage(JSON.parse(data.toString())));}catch(error){send({type:'error',error:error instanceof Error?error.message:'Invalid request.'});if(++invalid>=3)socket.close(1008,'Invalid messages');}
  });
  socket.on('error',()=>{});socket.once('close',()=>rooms.disconnect(id));
  (socket as any).heartbeat=()=>{if(!alive){socket.terminate();return;}alive=false;socket.ping();};
 });
 const sweep=setInterval(()=>rooms.sweep(),250),heartbeat=setInterval(()=>{for(const socket of ws.clients)(socket as any).heartbeat();},30000);
 await new Promise<void>((res,rej)=>{http.once('error',rej);http.listen(options.port??8180,options.host??'127.0.0.1',()=>res());});
 const port=(http.address() as {port:number}).port;
 let closing:Promise<void>|undefined;
 const close=()=>closing??=(async()=>{shuttingDown=true;clearInterval(sweep);clearInterval(heartbeat);await Promise.all([...rooms.rooms.values()].map(r=>(r.driver as WorkerDriver|undefined)?.flush()));await store?.flush();rooms.shutdown();for(const c of ws.clients)c.terminate();await new Promise<void>(res=>ws.close(()=>res()));await new Promise<void>(res=>http.close(()=>res()));})();
 return{port,close,rooms,stats:()=>({bytesSent,connections:ws.clients.size})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 startServer({port:Number(process.env.PORT)||8180,host:process.env.HOST??'0.0.0.0',dataDir:process.env.DATA_DIR??resolve('server-data'),publicOrigin:process.env.PUBLIC_ORIGIN,maxRooms:Number(process.env.MAX_ROOMS)||32}).then(server=>{console.log(`Ironvale multiplayer is running at http://localhost:${server.port}`);const stop=()=>{void server.close().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});};process.once('SIGINT',stop);process.once('SIGTERM',stop);}).catch(e=>{console.error('Ironvale server could not start:',e.message);process.exitCode=1;});
}
