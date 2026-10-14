import {mkdir,readdir,readFile,rename,writeFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import type {Room} from './rooms';
import {decodeSave} from '../src/sim/save';
export class CheckpointStore {
 private writes=new Map<string,Promise<void>>();private deleted=new Set<string>();
 constructor(private directory:string){}
 async init(){await mkdir(this.directory,{recursive:true});const probe=join(this.directory,'.write-check');await writeFile(probe,'ok',{mode:0o600});await unlink(probe);}
 save(room:Room){if(!room.lastState||this.deleted.has(room.code))return;const {driver,...metadata}=room;const text=JSON.stringify({version:1,room:metadata});
  const previous=this.writes.get(room.code)??Promise.resolve();const next=previous.catch(()=>{}).then(async()=>{if(this.deleted.has(room.code))return;const path=join(this.directory,`${room.code}.json`),tmp=path+'.tmp';await writeFile(tmp,text,{mode:0o600});await rename(tmp,path);});this.writes.set(room.code,next);void next.catch(e=>console.error('Ironvale checkpoint could not be written:',e.message));
 }
 remove(code:string){this.deleted.add(code);const previous=this.writes.get(code)??Promise.resolve();const next=previous.catch(()=>{}).then(async()=>{await unlink(join(this.directory,`${code}.json`)).catch(()=>{});});this.writes.set(code,next);}
 async flush(){await Promise.all([...this.writes.values()]);}
 async load():Promise<Room[]>{const rooms:Room[]=[];for(const file of await readdir(this.directory)){if(!/^[A-Z2-9]{6}\.json$/.test(file))continue;try{const data=JSON.parse(await readFile(join(this.directory,file),'utf8')),r=data.room;if(data.version!==1||!r||r.code+'.json'!==file||!['playing','finished'].includes(r.phase)||!Array.isArray(r.players)||r.players.length<2||r.capacity<2||r.capacity>8)throw new Error('Invalid room');r.lastState=decodeSave(JSON.stringify(r.lastState));r.players.forEach((p:any)=>{if(!Number.isInteger(p.seat)||p.seat<0||p.seat>=r.capacity||typeof p.tokenHash!=='string'||!['human','ai'].includes(p.controller))throw new Error('Invalid seat');});r.driver=undefined;rooms.push(r);}catch{console.error(`Ironvale skipped incompatible or damaged checkpoint ${file}.`);}}return rooms;}
}
