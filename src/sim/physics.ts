import type {Entity,GameState} from './types';
type Cell={active:Entity[];idle:Entity[]};
const mounted=new Set(['cavalry','heavyCavalry','scout']);
const radius=(e:Entity)=>e.type==='ram'||e.type==='trebuchet'?.4:mounted.has(e.type)?.29:.22;

/** Deterministic crowd contacts with bounded scans and displacement per tick. */
export function separateUnits(s:GameState,grids:Uint8Array[]):void{
 const cells=new Map<number,Cell>(),active:Entity[]=[],displaced=new Map<number,number>();
 for(const e of Object.values(s.entities)){
  if(e.kind!=='unit'||e.hp<=0||e.garrisoned!==undefined)continue;
  const key=Math.floor(e.y)*s.size+Math.floor(e.x);let cell=cells.get(key);
  if(!cell){cell={active:[],idle:[]};cells.set(key,cell);}
  if(e.order.kind==='idle')cell.idle.push(e);else{cell.active.push(e);active.push(e);}
 }
 const move=(e:Entity,dx:number,dy:number)=>{
  const used=displaced.get(e.id)??0,length=Math.hypot(dx,dy),factor=Math.min(1,Math.max(0,.09-used)/Math.max(.00001,length));
  const x=e.x+dx*factor,y=e.y+dy*factor,grid=grids[e.owner<0?s.players.length:e.owner];
  if(x>1&&y>1&&x<s.size-1&&y<s.size-1&&!grid[Math.floor(y)*s.size+Math.floor(x)]&&!grid[Math.floor(e.y)*s.size+Math.floor(x)]&&!grid[Math.floor(y)*s.size+Math.floor(e.x)]){
   e.x=x;e.y=y;displaced.set(e.id,used+length*factor);
  }
 };
 for(const a of active){
  const ax=Math.floor(a.x),ay=Math.floor(a.y);
  for(let y=ay-1;y<=ay+1;y++)for(let x=ax-1;x<=ax+1;x++){
   const cell=cells.get(y*s.size+x);if(!cell)continue;let contacts=0;
   const scan=(list:Entity[],moving:boolean,limit:number)=>{
    // Separate active contacts from idle prefixes; rotate oversized windows with the saved tick.
    const start=list.length>limit?(s.tick+a.id*7)%list.length:0;
    for(let i=0;i<Math.min(limit,list.length)&&contacts<8;i++){
     const b=list[(start+i)%list.length];if(b.id===a.id||moving&&b.id<a.id)continue;
     const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),minimum=radius(a)+radius(b);if(d>=minimum)continue;
     contacts++;const angle=(a.id*17+b.id*31)*.618,ux=d>.0001?dx/d:Math.cos(angle),uy=d>.0001?dy/d:Math.sin(angle),force=Math.min(.045,(minimum-d)*.22);
     move(a,-ux*force,-uy*force);if(moving)move(b,ux*force,uy*force);
    }
   };
   scan(cell.active,true,cell.idle.length?12:24);scan(cell.idle,false,cell.active.length>1?12:24);
  }
 }
}
