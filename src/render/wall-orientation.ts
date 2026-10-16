import {BUILDINGS} from '../sim/definitions';
import type {BuildingType,Entity} from '../sim/types';

/** Connections are in model space, after applying the inverse of yaw.
 * mask: N=1, E=2, S=4, W=8. Gate ports: two offsets per N/E/S/W edge,
 * ordered from negative to positive X (N/S) or Z (E/W). */
export interface WallLayout {yaw:number;mask:number;gatePorts:number}

/** Infer connected models from this player's known snapshot, never the hidden world. */
export function wallLayouts(entities:readonly Entity[]):Map<number,WallLayout>{
 const walls=entities.filter(e=>e.kind==='building'&&e.hp>0&&(e.type==='palisade'||e.type==='wall'||e.type==='gate'));
 const occupied=new Set<string>(),key=(owner:number,x:number,y:number)=>`${owner}:${x}:${y}`;
 // Footprints are bounded (one tile for walls, two for gates), so both passes are O(n).
 for(const e of walls){const n=BUILDINGS[e.type as BuildingType].size;for(let y=0;y<n;y++)for(let x=0;x<n;x++)occupied.add(key(e.owner,e.x+x,e.y+y));}
 const layouts=new Map<number,WallLayout>();
 for(const e of walls){
  const n=BUILDINGS[e.type as BuildingType].size;
  let mask=0,gatePorts=0;
  for(let offset=0;offset<n;offset++){
   const sides=[occupied.has(key(e.owner,e.x+offset,e.y-1)),occupied.has(key(e.owner,e.x+n,e.y+offset)),occupied.has(key(e.owner,e.x+offset,e.y+n)),occupied.has(key(e.owner,e.x-1,e.y+offset))];
   for(let side=0;side<4;side++)if(sides[side]){mask|=1<<side;if(n===2)gatePorts|=1<<(side*2+offset);}
  }
  // Count connected sides, not tiles: a gate beside two tiles is still one connection.
  const vertical=Number(Boolean(mask&1))+Number(Boolean(mask&4))>Number(Boolean(mask&2))+Number(Boolean(mask&8));
  if(vertical){
   mask=((mask<<1)&15)|(mask>>3);
   const rotatedPorts=[2,3,5,4,6,7,1,0];let rotated=0;
   for(let port=0;port<8;port++)if(gatePorts&(1<<port))rotated|=1<<rotatedPorts[port];
   gatePorts=rotated;
  }
  layouts.set(e.id,{yaw:vertical?Math.PI/2:0,mask,gatePorts});
 }
 return layouts;
}

/** Compatibility for callers that only need the instance orientation. */
export function wallOrientations(entities:readonly Entity[]):Map<number,number>{
 return new Map([...wallLayouts(entities)].map(([id,layout])=>[id,layout.yaw]));
}
