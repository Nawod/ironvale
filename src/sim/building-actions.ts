import type {Command,Entity,GameState,Position} from './types';
import {TICK_RATE} from './definitions';
import {bounds,buildingSize} from './navigation';
import {hostile} from './teams';
import {seen} from './visibility';
import {canBuildOnTerrain} from './terrain';

type BuildingAction=Extract<Command,{type:'moveBuilding'|'removeBuilding'}>;
const SAFE_DISTANCE=10;
const DAMAGE_COOLDOWN=10*TICK_RATE;

function safe(s:GameState,player:number,point:Position,size:number):boolean{
 return !Object.values(s.entities).some(e=>{
  if(e.hp<=0||e.garrisoned||e.kind==='resource'||!hostile(s,player,e.owner)||!seen(s,player,e))return false;
  const otherSize=buildingSize(e);
  const dx=Math.max(point.x-e.x-otherSize,e.x-point.x-size,0),dy=Math.max(point.y-e.y-otherSize,e.y-point.y-size,0);
  return Math.hypot(dx,dy)<=SAFE_DISTANCE;
 });
}
function clear(s:GameState,b:Entity,point:Position):boolean{
 const size=buildingSize(b);
 return !Object.values(s.entities).some(e=>{
  if(e.id===b.id)return false;
  if(e.kind==='building')return point.x<e.x+buildingSize(e)&&point.x+size>e.x&&point.y<e.y+buildingSize(e)&&point.y+size>e.y;
  if(e.kind==='unit'&&(e.hp<=0||e.garrisoned)||e.kind==='resource'&&e.amount<=0)return false;
  return e.x>=point.x&&e.x<point.x+size&&e.y>=point.y&&e.y<point.y+size;
 });
}

/** Apply only after validation so a rejected action cannot spend resources,
 * change the building, or discard any worker's interrupted work. */
export function applyBuildingAction(s:GameState,c:BuildingAction):string|null{
 const b=s.entities[c.building];
 if(!b||b.owner!==c.player||b.kind!=='building'||b.hp<=0)return 'Select a living building you own.';
 if(b.type==='capital'||s.players.some(p=>p.capital===b.id))return 'Original town centers must stay in place.';
 if(b.queue.length)return 'Finish this building\'s production or upgrade queue first.';
 if(b.garrison.length)return 'Ungarrison this building first.';
 if(b.lastDamagedTick!==undefined&&s.tick-b.lastDamagedTick<DAMAGE_COOLDOWN)return 'Wait ten seconds after this building was attacked.';
 const size=buildingSize(b);
 if(!safe(s,c.player,b,size))return 'Clear visible enemies away from this building first.';
 if(c.type==='moveBuilding'){
  if(b.progress!==1)return 'Finish construction before moving this building.';
  const point=c.point;
  if(!point||!Number.isInteger(point.x)||!Number.isInteger(point.y)||!bounds(s,point)||point.x+size>=s.size-1||point.y+size>=s.size-1)return 'Choose clear land inside the map.';
  for(let y=point.y;y<point.y+size;y++)for(let x=point.x;x<point.x+size;x++)if(!s.visible[c.player]?.[y*s.size+x])return 'Scout this land before moving a building.';
  if(!canBuildOnTerrain(s.terrain,s.size,point.x,point.y,size))return 'Choose land away from water and crossings.';
  if(!clear(s,b,point))return 'Choose land clear of buildings, resources and units.';
  if(!safe(s,c.player,point,size))return 'Clear visible enemies away from the destination first.';
  b.x=point.x;b.y=point.y;
 }else{
  // Missing targets are handled by the normal worker task and wall transitions.
  // Retain worker queues so each worker can resume their own valid saved work.
  delete s.entities[b.id];
 }
 return null;
}
