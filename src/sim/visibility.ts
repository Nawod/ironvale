import type { Entity, GameState, Snapshot } from './types';
import { BUILDINGS, UNITS } from './definitions';
import {allianceKey} from './teams';
import {isAnimal} from './nature';
export function seen(s:GameState,player:number,e:Entity):boolean {const x=Math.floor(e.x),y=Math.floor(e.y);return e.owner===player||Boolean(s.visible[player]?.[y*s.size+x]);}
export function updateVisibility(s:GameState):void {
 for(const a of s.visible)a.fill(0);
 for(const e of Object.values(s.entities)){
  if(e.owner<0||e.hp<=0||e.garrisoned||!s.players[e.owner].alive)continue;
  const radius=e.kind==='unit'?UNITS[e.type as keyof typeof UNITS].sight:e.progress<1?4:BUILDINGS[e.type as keyof typeof BUILDINGS].range?10:8;
  const x=Math.floor(e.x),y=Math.floor(e.y);
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(dx*dx+dy*dy<=radius*radius){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<s.size&&ny<s.size){s.visible[e.owner][ny*s.size+nx]=1;s.explored[e.owner][ny*s.size+nx]=1;}}
 }
 const groups=new Map<string,number[]>();for(const p of s.players){const key=allianceKey(p);groups.set(key,[...(groups.get(key)??[]),p.id]);}
 for(const members of groups.values())if(members.length>1){for(let i=0;i<s.size*s.size;i++){let visible=0,explored=0;for(const id of members){visible|=s.visible[id][i];explored|=s.explored[id][i];}for(const id of members){s.visible[id][i]=visible;s.explored[id][i]=explored;}}}
 for(const p of s.players){for(const e of Object.values(s.entities))if((e.kind==='building'||e.kind==='resource')&&e.owner!==p.id&&seen(s,p.id,e))s.intel[p.id][e.id]={...structuredClone(e),ghost:true,queue:[]};
  for(const [id,e] of Object.entries(s.intel[p.id]))if(s.visible[p.id][Math.floor(e.y)*s.size+Math.floor(e.x)]&&(!s.entities[+id]||isAnimal(e)&&(Math.floor(s.entities[+id].x)!==Math.floor(e.x)||Math.floor(s.entities[+id].y)!==Math.floor(e.y))))delete s.intel[p.id][+id];
 }
}
export function population(s:GameState,player:number):number{return Object.values(s.entities).filter(e=>e.owner===player&&e.kind==='unit').length;}
export function capacity(s:GameState,player:number):number {return Math.min(100,Object.values(s.entities).filter(e=>e.owner===player&&e.kind==='building'&&e.progress===1&&e.hp>0).reduce((n,e)=>n+(BUILDINGS[e.type as keyof typeof BUILDINGS].capacity??0),0));}
export function snapshot(s:GameState,player=0):Snapshot {
 const entities:Entity[]=[];
 for(const e of Object.values(s.entities)){
  if(e.garrisoned)continue;
  const known=seen(s,player,e);
  if(known)entities.push(structuredClone(e));
 }
 const ids=new Set(entities.map(e=>e.id));for(const e of Object.values(s.intel[player]))if(!ids.has(e.id))entities.push(structuredClone(e));
 for(const copy of entities){if(copy.owner!==player){copy.buildQueue=undefined;copy.queue=[];copy.order={kind:'idle'};copy.path=[];copy.pathGoal=undefined;copy.carry=undefined;copy.home=undefined;copy.garrison=[];}if(copy.attackFx&&(copy.ghost||!s.visible[player][Math.floor(copy.attackFx.y)*s.size+Math.floor(copy.attackFx.x)]))copy.attackFx=undefined;}
 return {playerId:player,tick:s.tick,size:s.size,terrain:s.terrain,entities,players:s.players.map(p=>p.id===player?structuredClone(p):{...p,resources:{food:0,wood:0,stone:0,gold:0},weapons:0,armor:0,ai:{nextThink:0,raids:0},age:1}),fog:s.explored[player].map((v,i)=>s.visible[player][i]?2:v?1:0),events:s.events.filter(e=>e.player===player||e.player===-1).slice(-8),winner:s.winner,paused:s.paused,config:s.config,population:population(s,player),capacity:capacity(s,player)};
}
