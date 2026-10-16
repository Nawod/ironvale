import type {GameState} from './types';
import {BUILDINGS,UNITS,wallUpgrade} from './definitions';
import {validateTeams} from './teams';
import {validResource} from './nature';
import {MAX_WORKER_TASKS,pendingTaskCount} from './tasks';
import {FORMATIONS} from './formations';
import {bounds} from './navigation';
import {canBuildOnTerrain,isWaterTerrain} from './terrain';
export function encodeSave(s:GameState):string{return JSON.stringify(s);}
export function decodeSave(text:string):GameState{
 let s:GameState;try{s=JSON.parse(text);}catch{throw new Error('This save is damaged and cannot be loaded.');}
 if(!s||typeof s!=='object'||s.version===undefined)throw new Error('This is not an Ironvale save.');
 if((s as any).version===1){s.version=2;if(Array.isArray(s.players))s.players.forEach(p=>p.controller=p.id===0?'human':'ai');}
 if(s.version!==2)throw new Error('This save version is incompatible with this version of Ironvale.');
 const valid=Number.isInteger(s.tick)&&s.tick>=0&&Number.isInteger(s.rng)&&Number.isInteger(s.nextId)&&s.config&&Number.isInteger(s.config.opponents)&&s.config.opponents>=1&&s.config.opponents<=7&&['easy','normal','hard'].includes(s.config.difficulty)&&s.size===(s.config.opponents===1?96:s.config.opponents<=3?128:s.config.opponents<=5?160:192)&&Array.isArray(s.terrain)&&s.terrain.length===s.size*s.size&&Array.isArray(s.players)&&s.players.length===s.config.opponents+1&&s.entities&&typeof s.entities==='object'&&Array.isArray(s.events)&&Array.isArray(s.intel)&&s.intel.length===s.players.length&&Array.isArray(s.explored)&&Array.isArray(s.visible);
 if(!valid)throw new Error('This save is damaged or incomplete.');
 if(s.config.mapType!==undefined&&s.config.mapType!=='lowlands'&&s.config.mapType!=='riverlands')throw new Error('This save contains an invalid map type.');
 if(s.terrain.some(v=>!Number.isInteger(v)||v<0||v>(s.config.mapType==='riverlands'?5:2)))throw new Error('This save contains invalid terrain data.');
 if(s.config.zombies!==undefined&&typeof s.config.zombies!=='boolean'||s.zombieNight!==undefined&&(!s.config.zombies||!Number.isSafeInteger(s.zombieNight)||s.zombieNight<0))throw new Error('This save contains invalid zombie mode data.');
 for(const p of s.players){if(!['human','ai'].includes(p.controller)||p.alive&&!s.entities[p.capital]||p.id<0||p.id>=s.players.length||![1,2,3].includes(p.age)||!p.ai||!p.resources||Object.values(p.resources).some(v=>!Number.isFinite(v)||v<0))throw new Error('This save contains invalid empire data.');}
 for(const arrays of [s.explored,s.visible])if(arrays.length!==s.players.length||arrays.some(a=>!Array.isArray(a)||a.length!==s.size*s.size))throw new Error('This save contains invalid map data.');
 for(const e of Object.values(s.entities)){if(!Number.isInteger(e.id)||e.id>=s.nextId||!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.y<0||e.x>=s.size||e.y>=s.size||!e.order||!Array.isArray(e.path)||!Array.isArray(e.queue)||!Array.isArray(e.garrison)||e.buildQueue!==undefined&&(!Array.isArray(e.buildQueue)||e.buildQueue.length>128||e.buildQueue.some(id=>!Number.isInteger(id)||id<1||id>=s.nextId))||!Number.isFinite(e.hp)||e.kind==='unit'&&!UNITS[e.type as keyof typeof UNITS]||e.kind==='building'&&!BUILDINGS[e.type as keyof typeof BUILDINGS])throw new Error('This save contains invalid unit or building data.');}
 for(const e of Object.values(s.entities)){
  if(e.kind==='building'?!canBuildOnTerrain(s.terrain,s.size,e.x,e.y,BUILDINGS[e.type as keyof typeof BUILDINGS].size):!e.garrisoned&&isWaterTerrain(s.terrain[Math.floor(e.y)*s.size+Math.floor(e.x)]))throw new Error('This save contains invalid terrain placement.');
  const dryPoint=(p:any)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<s.size&&p.y<s.size&&!isWaterTerrain(s.terrain[Math.floor(p.y)*s.size+Math.floor(p.x)]);
  if(e.path.some(p=>!dryPoint(p))||e.home!==undefined&&!dryPoint(e.home))throw new Error('This save contains an invalid terrain path or home.');
  if(e.formation!==undefined&&(e.kind!=='unit'||!FORMATIONS.includes(e.formation)))throw new Error('This save contains invalid formation data.');
  if(e.rally!==undefined){const r=e.rally;if(e.kind!=='building'||!BUILDINGS[e.type as keyof typeof BUILDINGS]?.trains?.length||!r||!r.point||!bounds(s,r.point)||r.target!==undefined&&(!Number.isSafeInteger(r.target)||r.target<1||r.target>=s.nextId))throw new Error('This save contains invalid rally data.');}
  if(e.lastDamagedTick!==undefined&&(!Number.isSafeInteger(e.lastDamagedTick)||e.lastDamagedTick<0||e.lastDamagedTick>s.tick))throw new Error('This save contains invalid building damage data.');
  if(e.owner===-2||e.type==='zombie'){if(!s.config.zombies||e.owner!==-2||e.type!=='zombie'||e.kind!=='unit'||!e.home||!Number.isFinite(e.home.x)||!Number.isFinite(e.home.y)||e.home.x<0||e.home.y<0||e.home.x>=s.size||e.home.y>=s.size||e.garrisoned!==undefined||e.garrison.length||e.queue.length)throw new Error('This save contains invalid zombie data.');}
 }
 if(Object.values(s.entities).filter(e=>e.type==='zombie').length>96)throw new Error('This save contains too many zombies.');
 for(const e of Object.values(s.entities))if(e.kind==='resource'&&(!validResource(e.type)||!Number.isFinite(e.amount)||e.amount<0))throw new Error('This save contains invalid resource data.');
 for(const e of Object.values(s.entities))if(e.taskQueue!==undefined){
  const point=(p:any)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<s.size&&p.y<s.size;
  const ids=(list:any)=>Array.isArray(list)&&list.length<=MAX_WORKER_TASKS&&list.every(id=>Number.isInteger(id)&&id>0&&id<s.nextId);
  if(e.kind!=='unit'||e.type!=='villager'||!Array.isArray(e.taskQueue)||e.taskQueue.length>MAX_WORKER_TASKS||e.taskQueue.some(t=>{
   const o=t?.order;if(!o||!['move','gather','build','repair','attack','attackMove','patrol'].includes(o.kind))return true;
   if(['move','attackMove','patrol'].includes(o.kind)?!point(o.point):!Number.isInteger(o.target)||o.target!<1||o.target!>=s.nextId)return true;
   return o.point!==undefined&&!point(o.point)||o.origin!==undefined&&!point(o.origin)||t.lastKnown!==undefined&&!point(t.lastKnown)||o.returning!==undefined&&typeof o.returning!=='boolean'||t.buildQueue!==undefined&&(o.kind!=='build'||!ids(t.buildQueue));
  })||pendingTaskCount(e)>MAX_WORKER_TASKS)throw new Error('This save contains invalid worker task data.');
 }
 for(const e of Object.values(s.entities)){
  if(e.wallTier!==undefined&&(e.wallTier!==3||e.kind!=='building'||e.type!=='wall'||e.maxHp!==1400))throw new Error('This save contains invalid wall building data.');
  const upgrades=e.queue.filter(q=>q.kind==='wall');if(!upgrades.length)continue;const d=wallUpgrade(e),q=upgrades[0];
  if(!d||e.progress!==1||e.hp<=0||e.queue.length!==1||!Number.isFinite(q.remaining)||q.remaining<0||q.remaining>q.total||q.total!==d.seconds||!q.cost||Object.keys(q.cost).length!==Object.keys(d.cost).length||Object.entries(d.cost).some(([r,n])=>q.cost[r as keyof typeof q.cost]!==n))throw new Error('This save contains invalid wall upgrade data.');
 }
 validateTeams(s.players);if(s.players.some(p=>p.team!==s.config.participants?.[p.id]?.team))throw new Error('This save contains inconsistent team data.');
 return s;
}
