import type {Entity,Snapshot} from '../sim/types';
import {BUILDINGS} from '../sim/definitions';
import {TERRAIN} from '../sim/terrain';
import type {LandscapeFields} from './landscape-surface';
export interface TerrainRegion {x0:number;y0:number;x1:number;y1:number}
/** A one-tile halo covers every shoreline/soil neighbor affected by fog changes. */
export function terrainFogChange(fog:readonly number[]|Uint8Array,previous:Uint8Array|undefined,size:number):{changed:boolean;knowledgeChanged:boolean;region?:TerrainRegion}{
 if(!previous||previous.length!==fog.length)return{changed:true,knowledgeChanged:true};
 let x0=size,y0=size,x1=-1,y1=-1,knowledgeChanged=false;
 for(let i=0;i<fog.length;i++)if(fog[i]!==previous[i]){const x=i%size,y=Math.floor(i/size);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);if(!!fog[i]!==!!previous[i])knowledgeChanged=true;}
 return x1<0?{changed:false,knowledgeChanged:false}:{changed:true,knowledgeChanged,region:{x0:Math.max(0,x0-1),y0:Math.max(0,y0-1),x1:Math.min(size,x1+2),y1:Math.min(size,y1+2)}};
}

/** Check scouting before any preview reads terrain or objects in its footprint. */
export function scoutedFootprint(s:Pick<Snapshot,'size'|'fog'>,x:number,y:number,n:number):boolean{
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<1||y<1||x+n>=s.size-1||y+n>=s.size-1)return false;
 for(let row=y;row<y+n;row++)for(let col=x;col<x+n;col++)if(s.fog[row*s.size+col]!==2)return false;
 return true;
}

/** Cosmetic paths use only entities already present in the player's snapshot. */
export function settlementSurfaceMask(size:number,entities:Entity[],detail=4):Uint8Array{
 const width=size*detail,mask=new Uint8Array(width*width);
 const buildings=entities.filter(e=>e.kind==='building'&&e.hp>0&&!['wall','palisade','gate','farm'].includes(e.type));
 const stamp=(x:number,y:number,radius:number,strength:number)=>{
  for(let py=Math.max(0,Math.floor((y-radius)*detail));py<Math.min(width,Math.ceil((y+radius)*detail));py++)for(let px=Math.max(0,Math.floor((x-radius)*detail));px<Math.min(width,Math.ceil((x+radius)*detail));px++){
   const distance=Math.hypot((px+.5)/detail-x,(py+.5)/detail-y),value=Math.round(strength*Math.max(0,Math.min(1,(radius-distance)*2)));
   const i=py*width+px;mask[i]=Math.max(mask[i],value);
  }
 };
 for(const b of buildings){
  const n=BUILDINGS[b.type as keyof typeof BUILDINGS].size,cx=b.x+n/2,cy=b.y+n/2;
  for(let y=Math.max(0,Math.floor((b.y-.25)*detail));y<Math.min(width,Math.ceil((b.y+n+.4)*detail));y++)for(let x=Math.max(0,Math.floor((b.x-.25)*detail));x<Math.min(width,Math.ceil((b.x+n+.25)*detail));x++)mask[y*width+x]=255;
  stamp(cx,cy+n/2+.35,1.35,240);
  const neighbour=buildings.filter(a=>a.owner===b.owner&&a.id<b.id).map(a=>({a,n:BUILDINGS[a.type as keyof typeof BUILDINGS].size})).map(({a,n})=>({x:a.x+n/2,y:a.y+n+.25,d:Math.hypot(a.x+n/2-cx,a.y+n+.25-(b.y+n+.25))})).filter(a=>a.d<15).sort((a,b)=>a.d-b.d)[0];
  if(neighbour){const from={x:cx,y:b.y+n+.25},steps=Math.ceil(neighbour.d*detail);for(let i=0;i<=steps;i++){const t=i/Math.max(1,steps);stamp(from.x+(neighbour.x-from.x)*t,from.y+(neighbour.y-from.y)*t,.65,225);}}
 }
 return mask;
}
/** Plane UVs start at the southern edge; simulation rows start at the north. */
export function terrainPixels(s:Pick<Snapshot,'size'|'terrain'|'fog'>,data:Uint8Array=new Uint8Array(s.size*s.size*4)):Uint8Array {
 for(let i=0;i<s.fog.length;i++){
  const f=s.fog[i],x=i%s.size,y=Math.floor(i/s.size),variant=(x*7+y*13)%4,dim=f===1?.42:1;
  const t=s.terrain[i],color=f===0?[22,37,30]:t===TERRAIN.water?[36,100,117]:t===TERRAIN.ford?[85,125,128]:t===TERRAIN.bridge?[157,146,121]:t===1?[143,133,94]:[91+variant*4,119+variant*3,74+variant*3];
  const dest=((s.size-1-y)*s.size+x)*4;
  for(let c=0;c<3;c++)data[dest+c]=color[c]*dim;data[dest+3]=255;
 }
 return data;
}
/** Sub-tile detail preserves the fog boundary: no surface from an unseen tile is sampled. */
export function terrainSurfacePixels(s:Pick<Snapshot,'size'|'terrain'|'fog'>,data:Uint8Array,detail=4,settlement?:Uint8Array,landscape?:LandscapeFields,region?:TerrainRegion):Uint8Array{
 const width=s.size*detail,soil=new Uint8Array(s.size*s.size),samples=new Uint8Array(soil.length),banks=new Uint16Array(soil.length),sinX=new Float64Array(width),cosY=new Float64Array(width);
 const {x0=0,y0=0,x1=s.size,y1=s.size}=region??{};
 for(let i=0;i<width;i++){sinX[i]=Math.sin(i*.13);cosY[i]=Math.cos(i*.11);}
 // Neighbor and visibility relationships belong to tiles, not texture pixels.
 // Precompute once, rather than repeating these scans for all 16 subpixels.
 for(let ty=y0;ty<y1;ty++)for(let tx=x0;tx<x1;tx++){
  const i=ty*s.size+tx;if(!s.fog[i]||s.terrain[i]>=TERRAIN.water)continue;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const nx=tx+dx,ny=ty+dy,index=ny*s.size+nx;if(nx<0||ny<0||nx>=s.size||ny>=s.size||!s.fog[index])continue;
   soil[i]+=s.terrain[index]===1?1:0;samples[i]++;
   if(s.terrain[index]===TERRAIN.water||s.terrain[index]===TERRAIN.ford)banks[i]|=1<<((dy+1)*3+dx+1);
  }
 }
 const grass=[111,127,70],earth=[164,141,103],sand=[168,154,117];
 const meadow=[143,153,83],lush=[91,132,68],forestFloor=[103,111,67],dry=[178,156,111],shore=[203,186,142],stone=[164,156,135];
 for(let y=y0*detail;y<y1*detail;y++)for(let x=x0*detail;x<x1*detail;x++){
  const tx=Math.floor(x/detail),ty=Math.floor(y/detail),i=ty*s.size+tx,f=s.fog[i],dest=((width-1-y)*width+x)*4;
  if(!f){data[dest]=22;data[dest+1]=37;data[dest+2]=30;data[dest+3]=255;continue;}
  const noise=((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%255/255,wide=sinX[x]*cosY[y],dim=f===1?.42:1;
  const t=s.terrain[i];
  if(t===TERRAIN.water||t===TERRAIN.ford||t===TERRAIN.bridge){
   const base=t===TERRAIN.water?[36,100,117]:t===TERRAIN.ford?[85,125,128]:[157,146,121];
   for(let c=0;c<3;c++)data[dest+c]=(base[c]+(noise-.5)*10)*dim;data[dest+3]=255;continue;
  }
  const yard=(settlement?.[y*width+x]??0)/255,blend=Math.max(yard*.94,Math.max(0,.09+.65*soil[i]/Math.max(1,samples[i])+.13*wide));
  // Sand follows only known water; an unseen river cannot alter a visible bank.
  let bank=0;const wx=(x+.5)/detail,wy=(y+.5)/detail;
  for(let bit=0;bit<9&&banks[i];bit++){if(!(banks[i]&(1<<bit)))continue;const nx=tx+bit%3-1,ny=ty+Math.floor(bit/3)-1;
   const d=Math.hypot(Math.max(nx-wx,0,wx-(nx+1)),Math.max(ny-wy,0,wy-(ny+1)));bank=Math.max(bank,Math.max(0,1-d/1.05));
  }
  if(landscape){
   const stride=s.size+1,climate=landscape.moisture,fx=(x%detail+.5)/detail,fy=(y%detail+.5)/detail,top=climate[ty*stride+tx]*(1-fx)+climate[ty*stride+tx+1]*fx,bottom=climate[(ty+1)*stride+tx]*(1-fx)+climate[(ty+1)*stride+tx+1]*fx,moisture=top*(1-fy)+bottom*fy;
   const index=y*width+x,litter=landscape.woodland[index]/255,gravel=landscape.rock[index]/255,paving=landscape.paving[index]/255,soilMix=Math.max(yard*.95,soil[i]/Math.max(1,samples[i])*.42+Math.max(0,.55-moisture)*.65);
   for(let c=0;c<3;c++){
    let land=meadow[c]*(1-moisture)+lush[c]*moisture;land=land*(1-soilMix)+dry[c]*soilMix;
    const bed=litter*(1-yard)*.62;land=land*(1-bed)+forestFloor[c]*bed;land=land*(1-gravel*.55)+stone[c]*gravel*.55;
    land=land*(1-bank*.9)+shore[c]*bank*.9;land=land*(1-paving*.94)+stone[c]*paving*.94;
    data[dest+c]=Math.max(0,(land+(noise-.5)*16+wide*3)*dim);
   }
  }else for(let c=0;c<3;c++){const land=grass[c]*(1-blend)+earth[c]*blend;data[dest+c]=Math.max(0,(land*(1-bank*.85)+sand[c]*bank*.85+(noise-.5)*20)*dim);}
  data[dest+3]=255;
 }
 return data;
}
