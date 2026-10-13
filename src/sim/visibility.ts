import type { Entity, GameState, Snapshot } from './types';
import { BUILDINGS, UNITS } from './definitions';
export function seen(s:GameState,player:number,e:Entity):boolean {const x=Math.floor(e.x),y=Math.floor(e.y);return e.owner===player||Boolean(s.visible[player]?.[y*s.size+x]);}
export function updateVisibility(s:GameState):void {
 for(const a of s.visible)a.fill(0);
 for(const e of Object.values(s.entities)){
  if(e.owner<0||e.hp<=0||e.garrisoned||!s.players[e.owner].alive)continue;
  const radius=e.kind==='unit'?UNITS[e.type as keyof typeof UNITS].sight:e.progress<1?4:BUILDINGS[e.type as keyof typeof BUILDINGS].range?10:8;
  const x=Math.floor(e.x),y=Math.floor(e.y);
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(dx*dx+dy*dy<=radius*radius){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<s.size&&ny<s.size){s.visible[e.owner][ny*s.size+nx]=1;s.explored[e.owner][ny*s.size+nx]=1;}}
 }
 for(const p of s.players){for(const e of Object.values(s.entities))if(e.kind==='building'&&e.owner!==p.id&&seen(s,p.id,e))s.intel[p.id][e.id]={...structuredClone(e),ghost:true,queue:[]};
  for(const [id,e] of Object.entries(s.intel[p.id]))if(s.visible[p.id][Math.floor(e.y)*s.size+Math.floor(e.x)]&&!s.entities[+id])delete s.intel[p.id][+id];
 }
}
export function population(s:GameState,player:number):number{return Object.values(s.entities).filter(e=>e.owner===player&&e.kind==='unit').length;}
export function capacity(s:GameState,player:number):number {return Math.min(100,Object.values(s.entities).filter(e=>e.owner===player&&e.kind==='building'&&e.progress===1&&e.hp>0).reduce((n,e)=>n+(BUILDINGS[e.type as keyof typeof BUILDINGS].capacity??0),0));}
export function snapshot(s:GameState,player=0):Snapshot {
 const entities:Entity[]=[];
 for(const e of Object.values(s.entities)){
  if(e.garrisoned)continue;
  const known=e.kind==='resource'?s.explored[player][Math.floor(e.y)*s.size+Math.floor(e.x)]:seen(s,player,e);
  if(known){const copy=structuredClone(e);if(e.owner!==player){copy.queue=[];copy.order={kind:'idle'};copy.path=[];copy.pathGoal=undefined;copy.carry=undefined;}if(copy.attackFx&&!s.visible[player][Math.floor(copy.attackFx.y)*s.size+Math.floor(copy.attackFx.x)])copy.attackFx=undefined;entities.push(copy);}
 }
 for(const e of Object.values(s.intel[player]))if(!entities.some(v=>v.id===e.id))entities.push(structuredClone(e));
 return {tick:s.tick,size:s.size,terrain:s.terrain,entities,players:s.players.map(p=>p.id===player?structuredClone(p):{...p,resources:{food:0,wood:0,stone:0,gold:0},weapons:0,armor:0,ai:{nextThink:0,raids:0},age:1}),fog:s.explored[player].map((v,i)=>s.visible[player][i]?2:v?1:0),events:s.events.filter(e=>e.player===player||e.player===-1).slice(-8),winner:s.winner,paused:s.paused,config:s.config,population:population(s,player),capacity:capacity(s,player)};
}
