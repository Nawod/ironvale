import type {Position,Resource,Resources,Snapshot} from '../sim/types';
import {BUILDINGS} from '../sim/definitions';
import {wallLineTiles,MAX_WALL_LINE_TILES} from '../sim/wall-lines';
import {canBuildOnTerrain} from '../sim/terrain';
import {scoutedFootprint} from './terrain3d';

export interface WallPlanPreview {
 tiles:(Position&{valid:boolean;reused:boolean})[];
 reused:number;
 cost:Partial<Resources>;
 error?:string;
}
/** Advisory only; the authoritative command rechecks cost, land and tasks.
 * Never consult terrain or occupancy until the whole route is currently seen. */
export function wallPlanPreview(s:Snapshot,building:'palisade'|'wall',start:Position,end:Position):WallPlanPreview {
 const route=wallLineTiles(start,end);
 if(!route)return{tiles:[],reused:0,cost:{},error:`Choose at most ${MAX_WALL_LINE_TILES} sections.`};
 const result:WallPlanPreview={tiles:route.map(p=>({...p,valid:false,reused:false})),reused:0,cost:{}};
 if(route.some(p=>!scoutedFootprint(s,p.x,p.y,1))){result.error='Scout the whole line on clear land first.';return result;}
 const obstacles=s.entities.filter(e=>e.kind==='building'||e.kind==='resource'&&e.amount>0);
 let jobs=0;
 for(const tile of result.tiles){
  tile.valid=canBuildOnTerrain(s.terrain,s.size,tile.x,tile.y,1);
  let existing=false;
  for(const e of obstacles){
   const n=e.kind==='building'?BUILDINGS[e.type as keyof typeof BUILDINGS].size:0;
   const overlap=n?tile.x<e.x+n&&tile.x+1>e.x&&tile.y<e.y+n&&tile.y+1>e.y:e.x>=tile.x&&e.x<tile.x+1&&e.y>=tile.y&&e.y<tile.y+1;
   if(!overlap)continue;
   if(existing||e.kind!=='building'||e.owner!==s.playerId||e.hp<=0||!['palisade','wall'].includes(e.type)||e.x!==tile.x||e.y!==tile.y){tile.valid=false;continue;}
   existing=true;tile.reused=true;result.reused++;if(e.progress<1)jobs++;
  }
  if(!tile.reused)jobs++;
 }
 const count=route.length-result.reused,definition=BUILDINGS[building],player=s.players[s.playerId];
 for(const [resource,amount]of Object.entries(definition.cost))result.cost[resource as Resource]=amount!*count;
 if(result.tiles.some(p=>!p.valid))result.error='Choose clear land for the whole line.';
 else if(player.age<definition.age)result.error='Advance your town hall to unlock stone walls.';
 else if(!jobs)result.error='This line is already built.';
 else if(Object.entries(result.cost).some(([r,n])=>player.resources[r as Resource]<n!))result.error='Not enough resources for the whole line.';
 return result;
}
