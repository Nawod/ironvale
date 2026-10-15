import {expect,it} from 'vitest';
import {RoomService} from '../server/rooms';
import {validateMessage,validateCommand} from '../server/validation';
import {createGame,spawn} from '../src/sim/world';
import {encodeSave,decodeSave} from '../src/sim/save';
it('validates zombie settings and building commands without trusting player IDs',()=>{
 expect(validateMessage({type:'queue',name:'A',count:2,zombies:true})).toMatchObject({zombies:true});
 expect(()=>validateMessage({type:'queue',name:'A',count:2,zombies:'yes'})).toThrow();
 expect(validateCommand({type:'moveBuilding',building:3,point:{x:20,y:22},player:7})).toEqual({type:'moveBuilding',building:3,point:{x:20,y:22},player:0});
 expect(validateCommand({type:'removeBuilding',building:3,player:7})).toEqual({type:'removeBuilding',building:3,player:0});
 expect(()=>validateCommand({type:'moveBuilding',building:3,point:{x:Infinity,y:22}})).toThrow();
});
it('keeps zombie public queues separate through cancellation and rematching',()=>{
 let now=0;const starts:any[]=[],messages:Record<string,any[]>={};const service=new RoomService({now:()=>now,countdownMs:1,driver:room=>{starts.push(room);return{submit(){},controller(){},stop(){},checkpoint(){}};}});
 const send=(id:string,zombies:boolean)=>{messages[id]=[];service.connect(id,{send:m=>messages[id].push(m),close(){}});service.handle(id,validateMessage({type:'queue',name:id,count:2,zombies}));};
 send('classic',false);send('a',true);send('b',true);send('c',true);
 service.handle('a',{type:'cancel'});now=2;service.sweep();expect(starts).toHaveLength(1);expect(starts[0].config.zombies).toBe(true);expect(starts[0].config.participants.map((p:any)=>p.name)).toEqual(['c','b']);expect(messages.classic.at(-1).type).toBe('queued');
});
it('saves neutral undead and rejects malformed or player-owned zombies',()=>{
 const s=createGame({opponents:1,difficulty:'normal',seed:42,zombies:true});s.zombieNight=0;const z=spawn(s,'unit','zombie',-2,{x:40,y:40});z.home={x:40,y:40};
 expect(decodeSave(encodeSave(s)).entities[z.id].owner).toBe(-2);
 z.owner=0;expect(()=>decodeSave(encodeSave(s))).toThrow();z.owner=-2;s.config.zombies=false;expect(()=>decodeSave(encodeSave(s))).toThrow();
});
