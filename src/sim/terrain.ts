import type {Position} from './types';

export const TERRAIN={grass:0,earth:1,woodland:2,water:3,ford:4,bridge:5,mountain:6} as const;
export const isWaterTerrain=(value:number):boolean=>value===TERRAIN.water;
export const isBlockedTerrain=(value:number):boolean=>isWaterTerrain(value)||value===TERRAIN.mountain;

/** Matches the mesh diagonal from the upper-right to the lower-left vertex. */
export function terrainHeight(s:{size:number;elevation?:number[]},x:number,y:number):number{
 if(!s.elevation||!Number.isFinite(x)||!Number.isFinite(y))return 0;
 x=Math.max(0,Math.min(s.size,x));y=Math.max(0,Math.min(s.size,y));
 const col=Math.min(s.size-1,Math.floor(x)),row=Math.min(s.size-1,Math.floor(y)),u=x-col,v=y-row,stride=s.size+1,i=row*stride+col;
 const a=s.elevation[i],b=s.elevation[i+1],c=s.elevation[i+stride],d=s.elevation[i+stride+1];
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}

/** Footprints include every tile they touch; permanent crossings stay clear. */
export function canBuildOnTerrain(terrain:number[],size:number,x:number,y:number,n:number,elevation?:number[]):boolean{
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isInteger(n)||n<1||x<0||y<0||x+n>size||y+n>size)return false;
 for(let row=Math.floor(y);row<Math.ceil(y+n);row++)for(let col=Math.floor(x);col<Math.ceil(x+n);col++){
  const value=terrain[row*size+col];if(value!==TERRAIN.grass&&value!==TERRAIN.earth&&value!==TERRAIN.woodland)return false;
 }
 if(elevation){let low=Infinity,high=-Infinity;for(let row=Math.floor(y);row<=Math.ceil(y+n);row++)for(let col=Math.floor(x);col<=Math.ceil(x+n);col++){const h=elevation[row*(size+1)+col];low=Math.min(low,h);high=Math.max(high,h);}if(high-low>.7)return false;}
 return true;
}

/** A monotone channel has two connected banks. Dynamic programming bends the
 * channel around safe starting circles without cutting gaps through the water.
 * This consumes no simulation randomness, preserving the legacy random stream. */
export function generateRiverlands(terrain:number[],size:number,seed:number,starts:Position[]):void{
 const halfWidth=4,margin=halfWidth+16,parents=new Int16Array(size*size).fill(-1);
 let previous=new Float64Array(size).fill(Infinity);
 const phase=(seed>>>0)%6283/1000;
 for(let y=0;y<size;y++){
  const next=new Float64Array(size).fill(Infinity),ideal=size/2+Math.sin(y*.045+phase)*size*.055+Math.sin(y*.09+phase)*2;
  for(let x=halfWidth+2;x<size-halfWidth-2;x++){
   if(starts.some(p=>(p.x-x)**2+(p.y-y)**2<=margin*margin))continue;
   const local=(x-ideal)**2;
   if(!y){next[x]=local;continue;}
   for(let dx=-1;dx<=1;dx++){const from=x+dx,cost=previous[from]+local+(dx?3:0);if(cost<next[x]){next[x]=cost;parents[y*size+x]=from;}}
  }
  previous=next;
 }
 let x=0;for(let i=1;i<size;i++)if(previous[i]<previous[x])x=i;
 if(!Number.isFinite(previous[x]))throw new Error('Unable to generate a safe river for these starting cities.');
 const centers=new Int16Array(size);
 for(let y=size-1;y>=0;y--){centers[y]=x;x=parents[y*size+x];}
 const bridge=Math.round(size*.33),ford=Math.round(size*.67);
 for(let y=0;y<size;y++)for(let dx=-halfWidth;dx<=halfWidth;dx++){
  terrain[y*size+centers[y]+dx]=Math.abs(y-bridge)<=1?TERRAIN.bridge:Math.abs(y-ford)<=2?TERRAIN.ford:TERRAIN.water;
 }
}
