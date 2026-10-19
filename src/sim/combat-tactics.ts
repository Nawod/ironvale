import type {Entity,GameState,Position} from './types';
import {distance} from './types';
import {BUILDINGS,UNITS} from './definitions';
import {buildingSize} from './navigation';
import {TERRAIN,terrainHeight} from './terrain';

type TerrainView=Pick<GameState,'size'|'terrain'|'elevation'>;
export interface AttackRange {base:number;bonus:number;max:number;heightAdvantage:number}
const center=(e:Entity):Position=>{const n=buildingSize(e)/2;return{x:e.x+n,y:e.y+n};};
function baseRange(e:Entity):number{return e.kind==='unit'?UNITS[e.type as keyof typeof UNITS].range:e.kind==='building'?BUILDINGS[e.type as keyof typeof BUILDINGS].range??0:0;}
/** Target-dependent downhill reach; omitting the target exposes the upper bound
 * for acquisition and UI. No height data means the original flat-map range. */
export function attackRange(s:TerrainView,a:Entity,b?:Entity):AttackRange{
 const base=baseRange(a),from=center(a),to=b?center(b):undefined;
 const heightAdvantage=to&&s.elevation?Math.max(0,terrainHeight(s,from.x,from.y)-terrainHeight(s,to.x,to.y)):0;
 const bonus=base>2&&s.elevation?base*(to?Math.min(.2,heightAdvantage*.05):.2):0;
 return{base,bonus,max:base+bonus,heightAdvantage};
}
/** Only solid mountain terrain occludes projectiles. Forests, walls and units
 * retain their existing interaction and friendly-fire rules. Siege has an arc,
 * but a ridge taller than that arc still intercepts it. */
export function clearAttackLine(s:TerrainView,a:Entity,b:Entity):boolean{
 if(!s.elevation||baseRange(a)<=2)return true;
 const from=center(a),to=center(b),length=distance(from,to);
 const start=terrainHeight(s,from.x,from.y)+(a.kind==='building'?2.5:.9),end=terrainHeight(s,to.x,to.y)+(b.kind==='building'?1.5:.7);
 const arc=a.type==='trebuchet'?Math.max(4,length*.7):0;
 // Split at tile edges and mesh triangle diagonals. Fixed-distance sampling
 // can miss a thin crossing near a mountain corner. Within each interval the
 // ground is linear and the arc is concave, so its endpoints suffice.
 const cuts=[0,1],crossings=(low:number,high:number)=>{
  if(low===high)return;
  for(let edge=Math.floor(Math.min(low,high))+1;edge<Math.max(low,high);edge++)cuts.push((edge-low)/(high-low));
 };
 crossings(from.x,to.x);crossings(from.y,to.y);crossings(from.x+from.y,to.x+to.y);cuts.sort((x,y)=>x-y);
 const blocked=(t:number)=>{const x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;return terrainHeight(s,x,y)>start+(end-start)*t+4*arc*t*(1-t);};
 for(let i=1;i<cuts.length;i++){
  const t=(cuts[i-1]+cuts[i])/2,x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;
  if(s.terrain[Math.floor(y)*s.size+Math.floor(x)]===TERRAIN.mountain&&(blocked(cuts[i-1])||blocked(cuts[i])))return false;
 }
 return true;
}
/** A local preference, measured in tiles, rather than a damage rebalance.
 * Applied only after the ordinary hostility, visibility and radius filters. */
export function counterPreference(a:Entity,b:Entity):number{
 if(a.kind!=='unit'||b.kind!=='unit')return 0;
 if(['spearman','pikeman'].includes(a.type)&&['cavalry','heavyCavalry','scout'].includes(b.type))return 2;
 if(['cavalry','heavyCavalry'].includes(a.type)&&['archer','crossbowman'].includes(b.type))return 2;
 if(['archer','crossbowman'].includes(a.type)&&['spearman','pikeman'].includes(b.type))return 2;
 return 0;
}
