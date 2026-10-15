import {BUILDINGS} from '../sim/definitions';
import type {BuildingType,Entity} from '../sim/types';

/** Infer wall-model yaw from this player's known snapshot, never the hidden world. */
export function wallOrientations(entities:readonly Entity[]):Map<number,number>{
 const walls=entities.filter(e=>e.kind==='building'&&e.hp>0&&(e.type==='palisade'||e.type==='wall'||e.type==='gate'));
 const occupied=new Set<string>(),key=(owner:number,x:number,y:number)=>`${owner}:${x}:${y}`;
 // Footprints are bounded (one tile for walls, two for gates), so both passes are O(n).
 for(const e of walls){const n=BUILDINGS[e.type as BuildingType].size;for(let y=0;y<n;y++)for(let x=0;x<n;x++)occupied.add(key(e.owner,e.x+x,e.y+y));}
 const rotations=new Map<number,number>();
 for(const e of walls){
  const n=BUILDINGS[e.type as BuildingType].size;
  let left=false,right=false,up=false,down=false;
  for(let offset=0;offset<n;offset++){
   left ||=occupied.has(key(e.owner,e.x-1,e.y+offset));right ||=occupied.has(key(e.owner,e.x+n,e.y+offset));
   up ||=occupied.has(key(e.owner,e.x+offset,e.y-1));down ||=occupied.has(key(e.owner,e.x+offset,e.y+n));
  }
  // Count connected sides, not tiles: a gate beside two tiles is still one connection.
  // Corners, equal junctions and isolated pieces keep the original X-aligned model.
  rotations.set(e.id,Number(up)+Number(down)>Number(left)+Number(right)?Math.PI/2:0);
 }
 return rotations;
}
