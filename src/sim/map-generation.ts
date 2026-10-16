import type {MapSize,MapType,Position} from './types';
import {isBlockedTerrain,TERRAIN} from './terrain';

export function battlefieldSize(players:number,mapSize:MapSize='large'):number{
 return mapSize==='huge'?256:(mapSize==='standard'?128:160)+Math.floor((players-1)/2)*32;
}
function seeded(seed:number):()=>number{let state=(seed>>>0)||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};}
const smooth=(t:number)=>t*t*(3-2*t);
function noise(seed:number,x:number,y:number):number{
 const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);
 const hash=(a:number,b:number)=>{let h=Math.imul(a^seed,374761393)^Math.imul(b,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
 const a=hash(ix,iy)*(1-u)+hash(ix+1,iy)*u,b=hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u;return a*(1-v)+b*v;
}
const segmentDistance=(x:number,y:number,a:Position,b:Position)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);};

/** A pure seeded generator, independent of the later simulation random stream.
 * Heights are mesh vertices; terrain codes describe actual movement obstacles. */
export function generateBattlefield(size:number,seed:number,mapType:MapType,starts:Position[]):{terrain:number[];elevation:number[]}{
 const rng=seeded(seed),terrain=Array<number>(size*size),heights=Array<number>(size*size),stride=size+1;
 const protectedDistance=(x:number,y:number)=>Math.min(...starts.map(p=>Math.hypot(x-p.x,y-p.y)));
 const ridges:Array<{points:Position[];width:number;height:number}>=[];
 for(let r=0;r<3+Math.floor(size/100);r++){
  const angle=rng()*Math.PI*2,length=size*(.22+rng()*.3),center={x:size*(.18+rng()*.64),y:size*(.18+rng()*.64)},points:Position[]=[];
  for(let i=0;i<6;i++){const along=(i/5-.5)*length,across=(rng()-.5)*size*.07;points.push({x:center.x+Math.cos(angle)*along-Math.sin(angle)*across,y:center.y+Math.sin(angle)*along+Math.cos(angle)*across});}
  ridges.push({points,width:3+rng()*3.5,height:8+rng()*2});
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,d=protectedDistance(x+.5,y+.5),hill=.12+1.45*(noise(seed+17,x/34,y/34)*.72+noise(seed+83,x/13,y/13)*.28);
  let mountain=0;
  for(const ridge of ridges){let nearest=Infinity;for(let j=1;j<ridge.points.length;j++)nearest=Math.min(nearest,segmentDistance(x+.5,y+.5,ridge.points[j-1],ridge.points[j]));mountain=Math.max(mountain,ridge.height*Math.exp(-((nearest/ridge.width)**2)));}
  mountain*=smooth(Math.max(0,Math.min(1,(d-18)/9)));
  heights[i]=Math.max(hill,mountain);
  const forest=noise(seed+333,x/11,y/11)*.7+noise(seed+991,x/4,y/4)*.3;
  terrain[i]=mountain>2?TERRAIN.mountain:forest>.57?TERRAIN.woodland:noise(seed+65,x/8,y/8)>.72?TERRAIN.earth:TERRAIN.grass;
 }
 const paintWater=(x:number,y:number,radius:number)=>{
  for(let cy=Math.max(0,Math.floor(y-radius));cy<=Math.min(size-1,Math.ceil(y+radius));cy++)for(let cx=Math.max(0,Math.floor(x-radius));cx<=Math.min(size-1,Math.ceil(x+radius));cx++)if(Math.hypot(cx+.5-x,cy+.5-y)<=radius&&protectedDistance(cx+.5,cy+.5)>18){terrain[cy*size+cx]=TERRAIN.water;heights[cy*size+cx]=0;}
 };
 if(mapType==='riverlands'){
  const angle=rng()*Math.PI,phase=rng()*Math.PI*2,offset=(rng()-.5)*size*.15,channel:Position[]=[];
  for(let t=-size;t<=size;t+=.8){const bend=offset+Math.sin(t/size*8+phase)*size*.105+Math.sin(t/size*17+phase)*size*.025;const p={x:size/2+Math.cos(angle)*t-Math.sin(angle)*bend,y:size/2+Math.sin(angle)*t+Math.cos(angle)*bend};channel.push(p);paintWater(p.x,p.y,3.1+(1+Math.sin(t/size*12+phase))*1.7);}
  // Two broad permanent crossings, wherever this seed's channel runs.
  for(const [index,t] of [-size*.2,size*.2].entries()){
   const at=channel.reduce((best,p)=>Math.abs((p.x-size/2)*Math.cos(angle)+(p.y-size/2)*Math.sin(angle)-t)<Math.abs((best.x-size/2)*Math.cos(angle)+(best.y-size/2)*Math.sin(angle)-t)?p:best);
   for(let y=Math.max(0,Math.floor(at.y-11));y<Math.min(size,Math.ceil(at.y+11));y++)for(let x=Math.max(0,Math.floor(at.x-11));x<Math.min(size,Math.ceil(at.x+11));x++)if(terrain[y*size+x]===TERRAIN.water&&Math.abs((x+.5-at.x)*Math.cos(angle)+(y+.5-at.y)*Math.sin(angle))<2.3)terrain[y*size+x]=index?TERRAIN.ford:TERRAIN.bridge;
  }
 }
 // Lakes vary in count, position, size and coastline; lowlands remain mostly dry.
 const lakeCount=mapType==='riverlands'?1+Math.floor(rng()*3):Math.floor(rng()*3);
 for(let j=0;j<lakeCount;j++){
  const cx=size*(.15+rng()*.7),cy=size*(.15+rng()*.7),rx=size*(.025+rng()*.04),ry=rx*(.6+rng()*.7);
  for(let y=Math.max(0,Math.floor(cy-ry*1.25));y<Math.min(size,cy+ry*1.25);y++)for(let x=Math.max(0,Math.floor(cx-rx*1.25));x<Math.min(size,cx+rx*1.25);x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<.8+noise(seed+100+j,x/5,y/5)*.4&&protectedDistance(x+.5,y+.5)>18){terrain[y*size+x]=TERRAIN.water;heights[y*size+x]=0;}
 }
 // A shared flat start circle contains the identical opening economy.
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,d=protectedDistance(x+.5,y+.5);
  if(d<16){terrain[i]=terrain[i]===TERRAIN.woodland?TERRAIN.woodland:TERRAIN.grass;heights[i]=.2;}
  else if(d<18)heights[i]=.2+(Math.min(1.6,heights[i])-.2)*smooth((d-16)/2);
 }
 // Connect every landmass without creating an artificial road around the border.
 const first=terrain.findIndex((v,i)=>!isBlockedTerrain(v)&&i%size>0&&i%size<size-1&&i>=size&&i<size*(size-1));
 const flood=()=>{const seen=new Uint8Array(size*size),queue=[first];seen[first]=1;for(let h=0;h<queue.length;h++){const i=queue[h],x=i%size,y=Math.floor(i/size);for(const j of [x>1?i-1:-1,x<size-2?i+1:-1,y>1?i-size:-1,y<size-2?i+size:-1])if(j>=0&&!seen[j]&&!isBlockedTerrain(terrain[j])){seen[j]=1;queue.push(j);}}return seen;};
 let reached=flood();
 for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++)if(!isBlockedTerrain(terrain[y*size+x])&&!reached[y*size+x]){
  // Search the nearest connected shore, then cut a road or crossing 5 tiles wide.
  let goal={x:1,y:1},best=Infinity;
  for(let cy=1;cy<size-1;cy++)for(let cx=1;cx<size-1;cx++)if(reached[cy*size+cx]){const d=(cx-x)**2+(cy-y)**2;if(d<best){best=d;goal={x:cx,y:cy};}}
  const length=Math.ceil(Math.hypot(goal.x-x,goal.y-y)*2);
  for(let k=0;k<=length;k++){const cx=Math.round(x+(goal.x-x)*k/(length||1)),cy=Math.round(y+(goal.y-y)*k/(length||1));for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const px=cx+dx,py=cy+dy;if(px<1||py<1||px>=size-1||py>=size-1)continue;const i=py*size+px;if(terrain[i]===TERRAIN.water)terrain[i]=TERRAIN.ford;else if(terrain[i]===TERRAIN.mountain)terrain[i]=TERRAIN.earth;heights[i]=.2;}}
  reached=flood();
 }
 const elevation=Array<number>(stride*stride);
 for(let y=0;y<=size;y++)for(let x=0;x<=size;x++){
  let total=0,count=0,water=false,walkable=false;
  for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){const cx=x+dx,cy=y+dy;if(cx<0||cy<0||cx>=size||cy>=size)continue;const i=cy*size+cx;total+=heights[i];count++;water ||= terrain[i]===TERRAIN.water||terrain[i]===TERRAIN.ford||terrain[i]===TERRAIN.bridge;walkable ||= !isBlockedTerrain(terrain[i]);}
  elevation[y*stride+x]=water?0:Math.min(walkable?1.6:12,total/count);
 }
 return {terrain,elevation};
}
