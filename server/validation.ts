import type {Command,Difficulty} from '../src/sim/types';
import type {ClientMessage,RoomSettings,VoiceSignal} from '../src/net/protocol';
import {BUILDINGS,UNITS} from '../src/sim/definitions';
import {wallLineTiles} from '../src/sim/wall-lines';
import {MAX_RECRUIT_BATCH} from '../src/sim/production';
const fail=():never=>{throw new Error('Invalid request. Please check your match settings or reconnect.');};
function object(v:unknown):Record<string,any>{if(!v||typeof v!=='object'||Array.isArray(v))return fail();return v as Record<string,any>;}
function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)return fail();return v;}
function bool(v:unknown):boolean{if(typeof v!=='boolean')return fail();return v;}
function name(v:unknown):string{if(typeof v!=='string')return fail();const n=v.trim();if(!n||n.length>32||/[\u0000-\u001f<>]/.test(n))return fail();return n;}
function code(v:unknown):string{if(typeof v!=='string'||!/^[A-Z2-9]{6}$/.test(v.toUpperCase()))return fail();return v.toUpperCase();}
function oneOf<T extends string>(v:unknown,values:readonly T[]):T{if(typeof v!=='string'||!values.includes(v as T))return fail();return v as T;}
function boundedString(v:unknown,max:number,min=0):string{if(typeof v!=='string'||v.length<min||v.length>max)return fail();return v;}
function voiceSignal(value:unknown):VoiceSignal{
 const m=object(value);
 if(m.type==='description'){const d=object(m.description);return{type:'description',description:{type:oneOf(d.type,['offer','answer'] as const),sdp:boundedString(d.sdp,12000)}};}
 if(m.type==='candidate'){const c=object(m.candidate);return{type:'candidate',candidate:{candidate:boundedString(c.candidate,2048),...(c.sdpMid!==undefined?{sdpMid:c.sdpMid===null?null:boundedString(c.sdpMid,256)}:{}),...(c.sdpMLineIndex!==undefined?{sdpMLineIndex:c.sdpMLineIndex===null?null:integer(c.sdpMLineIndex,0,65535)}:{}),...(c.usernameFragment!==undefined?{usernameFragment:c.usernameFragment===null?null:boundedString(c.usernameFragment,256)}:{})}};}
 return fail();
}
export function settings(v:unknown):RoomSettings{const m=object(v);return {capacity:integer(m.capacity,2,8),fillAI:bool(m.fillAI),difficulty:oneOf<Difficulty>(m.difficulty,['easy','normal','hard']),seed:integer(m.seed,0,0xffffffff),mode:m.mode===undefined?'ffa':oneOf(m.mode,['ffa','teams'] as const),...(m.zombies!==undefined?{zombies:bool(m.zombies)}:{}),...(m.mapType!==undefined?{mapType:oneOf(m.mapType,['lowlands','riverlands'] as const)}:{})};}
const point=(v:unknown)=>{const p=object(v);if(typeof p.x!=='number'||typeof p.y!=='number'||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>192||p.y>192)return fail();return{x:p.x,y:p.y};};
const ids=(v:unknown):number[]=>{if(!Array.isArray(v)||!v.length||v.length>1000)return fail();return [...new Set(v.map(n=>integer(n,1)))];};
export function validateCommand(value:unknown):Command{
 const m=object(value),player=0;
 switch(m.type){
  case 'formation':return{type:'formation',player,ids:ids(m.ids),formation:oneOf(m.formation,['line','box','spread'] as const)};
  case 'clearRally':return{type:'clearRally',player,building:integer(m.building,1)};
  case 'rally':return{type:'rally',player,building:integer(m.building,1),point:point(m.point),...(m.target!==undefined?{target:integer(m.target,1)}:{})};
  case 'order':{const o=object(m.order),kind=oneOf(o.kind,['idle','move','gather','build','repair','attack','attackMove','patrol','garrison'] as const);return{type:'order',player,ids:ids(m.ids),order:{kind,...(o.point!==undefined?{point:point(o.point)}:{}),...(o.target!==undefined?{target:integer(o.target,1)}:{})}};}
  case 'build':return{type:'build',player,workers:ids(m.workers),building:oneOf(m.building,Object.keys(BUILDINGS)) as any,point:point(m.point)};
  case 'buildWallLine':{const start=point(m.start),end=point(m.end);if(!wallLineTiles(start,end))return fail();return{type:'buildWallLine',player,workers:ids(m.workers),building:oneOf(m.building,['palisade','wall'] as const),start,end};}
  case 'recruit':return{type:'recruit',player,building:integer(m.building,1),unit:oneOf(m.unit,Object.keys(UNITS)) as any,...(m.count!==undefined?{count:integer(m.count,1,MAX_RECRUIT_BATCH)}:{})};
  case 'moveBuilding':return{type:'moveBuilding',player,building:integer(m.building,1),point:point(m.point)};
  case 'removeBuilding':return{type:'removeBuilding',player,building:integer(m.building,1)};
  case 'upgradeWall':return{type:'upgradeWall',player,building:integer(m.building,1)};
  case 'research':return{type:'research',player,building:integer(m.building,1),research:oneOf(m.research,['age','weapons','armor'] as const)};
  case 'trade':return{type:'trade',player,sell:oneOf(m.sell,['food','wood','stone','gold'] as const),buy:oneOf(m.buy,['food','wood','stone','gold'] as const)};
  case 'stance':return{type:'stance',player,ids:ids(m.ids),stance:oneOf(m.stance,['aggressive','defensive','hold'] as const)};
  case 'ungarrison':return{type:'ungarrison',player,building:integer(m.building,1)};
  case 'rebuild':return{type:'rebuild',player,workers:ids(m.workers)};
  default:return fail();
 }
}
export function validateMessage(value:unknown):ClientMessage{
 const m=object(value);
 switch(m.type){
  case 'create':return{type:'create',name:name(m.name),...settings(m)};
  case 'join':return{type:'join',name:name(m.name),code:code(m.code)};
  case 'queue':return{type:'queue',name:name(m.name),count:integer(m.count,2,8),mode:m.mode===undefined?'ffa':oneOf(m.mode,['ffa','teams'] as const),...(m.zombies!==undefined?{zombies:bool(m.zombies)}:{}),...(m.mapType!==undefined?{mapType:oneOf(m.mapType,['lowlands','riverlands'] as const)}:{})};
  case 'team':return{type:'team',team:integer(m.team,0,7),...(m.seat!==undefined?{seat:integer(m.seat,0,7)}:{})};
  case 'ready':return{type:'ready',ready:bool(m.ready)};
  case 'voiceState':return{type:'voiceState',channel:m.channel===null?null:oneOf(m.channel,['open','team'] as const),muted:bool(m.muted),session:integer(m.session,1)};
  case 'voiceSignal':return{type:'voiceSignal',to:boundedString(m.to,128,1),session:integer(m.session,1),targetSession:integer(m.targetSession,1),signal:voiceSignal(m.signal)};
  case 'settings':return{type:'settings',...settings(m)};
  case 'start':case 'cancel':case 'leave':return{type:m.type};
  case 'resume':if(typeof m.token!=='string'||!/^[a-f0-9]{64}$/.test(m.token))return fail();return{type:'resume',code:code(m.code),token:m.token};
  case 'command':return{type:'command',seq:integer(m.seq,1),command:validateCommand(m.command)};
  default:return fail();
 }
}
