import type { BuildingType, Entity, GameState, Resource, UnitType } from './types';
import { distance, military } from './types';
import { BUILDINGS, AGE_COSTS, UNITS } from './definitions';
import { applyCommand, affordable } from './economy';
import { capacity,population,seen } from './visibility';
import { canPlace } from './navigation';
import { random } from './world';
import {hostile} from './teams';
import {harvestedResource} from './nature';
export function updateAI(s:GameState,includeHuman=false):void{
 const interval=s.config.difficulty==='easy'?100:s.config.difficulty==='normal'?50:25;
 for(const p of s.players){
  if(!p.alive||p.controller==='human'&&!includeHuman||s.tick<p.ai.nextThink)continue;p.ai.nextThink=s.tick+interval;
  const all=Object.values(s.entities),own=all.filter(e=>e.owner===p.id),cap=s.entities[p.capital];if(!cap)continue;
  const workers=own.filter(e=>e.type==='villager'),army=own.filter(e=>military(e)&&e.type!=='scout'&&!e.garrisoned),scouts=own.filter(e=>e.type==='scout');
  const buildings=own.filter(e=>e.kind==='building'),idle=workers.filter(e=>e.order.kind==='idle'),ready=(t:string)=>buildings.some(e=>e.type===t&&e.progress===1&&e.hp>0),count=(t:string)=>buildings.filter(e=>e.type===t).length;
  const submit=(c:any)=>applyCommand(s,{...c,player:p.id});
  if(cap.hp<=0){submit({type:'rebuild',workers:workers.slice(0,3).map(e=>e.id)});continue;}
  const build=(type:BuildingType):boolean=>{
   if(!affordable(s,p.id,BUILDINGS[type].cost)||p.age<BUILDINGS[type].age)return false;
   const builder=idle[0]??workers.filter(e=>e.order.kind==='gather').sort((a,b)=>distance(a,cap)-distance(b,cap))[0];if(!builder)return false;
   for(let r=4;r<19;r+=2)for(let dx=-r;dx<=r;dx+=2)for(const dy of [-r,r]){const point={x:Math.floor(cap.x+dx),y:Math.floor(cap.y+dy)};if(canPlace(s,type,point)&&submit({type:'build',building:type,point,workers:[builder.id]})===null)return true;}return false;
  };
  if(population(s,p.id)>=capacity(s,p.id)-3&&!buildings.some(e=>e.type==='house'&&e.progress<1)&&capacity(s,p.id)<100)build('house');
  const unfinished=buildings.find(e=>e.progress<1&&e.hp>0&&!workers.some(w=>w.order.target===e.id&&w.order.kind==='build'));
  if(unfinished&&idle[0])submit({type:'order',ids:[idle[0].id],order:{kind:'build',target:unfinished.id}});
  if(!count('storage'))build('storage');else if(!count('barracks'))build('barracks');
  if(workers.length>=9&&count('farm')<Math.min(7,Math.floor(workers.length/3))&&!buildings.some(e=>e.type==='farm'&&e.progress<1))build('farm');
  if(cap.queue.length<1&&!scouts.length)submit({type:'recruit',building:cap.id,unit:'scout'});
  else if(cap.queue.length<1&&workers.length<(s.config.difficulty==='easy'?18:26))submit({type:'recruit',building:cap.id,unit:'villager'});
  const gathering=workers.filter(w=>w.order.kind==='gather'),onResource=(w:Entity):Resource|undefined=>{const t=w.order.target?s.entities[w.order.target]:undefined;return t?harvestedResource(t):undefined;};
  for(const worker of workers.filter(w=>w.order.kind==='idle')){
   const priorities:Resource[]=['food','wood','gold','stone'];const weights={food:.47,wood:.30,gold:p.age===1?.13:.16,stone:.10};
   priorities.sort((a,b)=>gathering.filter(w=>onResource(w)===a).length/weights[a]-gathering.filter(w=>onResource(w)===b).length/weights[b]);
   for(const r of priorities){const choices=all.filter(e=>e.amount>0&&seen(s,p.id,e)&&harvestedResource(e)===r&&(e.kind==='resource'||e.type==='farm'&&e.owner===p.id&&e.progress===1)).sort((a,b)=>distance(worker,a)+workers.filter(w=>w.order.target===a.id).length*4-(distance(worker,b)+workers.filter(w=>w.order.target===b.id).length*4));
    if(choices[0]&&submit({type:'order',ids:[worker.id],order:{kind:'gather',target:choices[0].id}})===null){gathering.push(worker);break;}
   }
  }
  if(p.age===2){for(const type of ['smithy','market','range','stable','tower']as BuildingType[])if(!count(type)){build(type);break;}}
  if(p.age===3){if(!count('workshop'))build('workshop');else if(!count('fortress'))build('fortress');}
  if(p.age<3&&cap.queue.length===0)submit({type:'research',building:cap.id,research:'age'});
  const ageReserved=p.age<3&&!cap.queue.some(q=>q.kind==='age')&&workers.length>=15;
  for(const b of buildings){if(b.queue.length||b.progress<1||b.hp<=0)continue;
   if(b.type==='smithy'){submit({type:'research',building:b.id,research:p.weapons<=p.armor?'weapons':'armor'});continue;}
   const trains=BUILDINGS[b.type as keyof typeof BUILDINGS].trains?.filter(u=>u!=='villager'&&u!=='scout'&&UNITS[u].age<=p.age);if(!trains?.length||army.length>=60)continue;
   if(ageReserved&&p.resources.food<(AGE_COSTS[p.age].food??0)+100)continue;
   const unit:UnitType=b.type==='workshop'?(army.filter(e=>e.type==='ram').length<3?'ram':'trebuchet'):trains[Math.floor(random(s)*trains.length)];submit({type:'recruit',building:b.id,unit});
  }
  if(ready('market')){for(const r of ['gold','stone']as Resource[])if(p.resources[r]<100){const sell=p.resources.wood>600?'wood':p.resources.food>700?'food':undefined;if(sell)submit({type:'trade',sell,buy:r});}}
  for(const scout of scouts)if(scout.order.kind==='idle'){
   for(let tries=0;tries<12;tries++){const point={x:5+Math.floor(random(s)*(s.size-10)),y:5+Math.floor(random(s)*(s.size-10))};if(!s.explored[p.id][point.y*s.size+point.x]||tries===11){submit({type:'order',ids:[scout.id],order:{kind:'move',point}});break;}}
  }
  const threats=all.filter(e=>military(e)&&hostile(s,p.id,e.owner)&&seen(s,p.id,e)&&distance(e,cap)<18);
  if(threats.length){submit({type:'order',ids:army.map(e=>e.id),order:{kind:'attackMove',point:{x:threats[0].x,y:threats[0].y}}});for(const w of workers.slice(0,2))if(cap.hp<cap.maxHp*.75)submit({type:'order',ids:[w.id],order:{kind:'repair',target:cap.id}});continue;}
  const known=Object.values(s.intel[p.id]).filter(e=>e.type==='capital'&&hostile(s,p.id,e.owner)&&s.players[e.owner]?.alive).sort((a,b)=>distance(cap,a)-distance(cap,b));
  const target=known.find(e=>e.id===p.ai.target)??known[0];if(!target||army.length<(s.config.difficulty==='easy'?12:8))continue;
  p.ai.target=target.id;const live=s.entities[target.id],fallen=live&&seen(s,p.id,live)&&live.hp<=0;
  const available=army.filter(e=>e.order.kind==='idle'||fallen&&e.stance!=='hold'||e.order.kind==='attackMove'&&e.order.point&&distance(e.order.point,{x:target.x-1,y:target.y+1})>Math.max(3,Math.sqrt(army.length)*1.5));
  if(available.length){const point={x:target.x-1,y:target.y+1};submit({type:'order',ids:available.map(e=>e.id),order:{kind:'attackMove',point}});p.ai.raids++;if(fallen){submit({type:'stance',ids:available.slice(0,3).map(e=>e.id),stance:'hold'});submit({type:'order',ids:available.slice(0,3).map(e=>e.id),order:{kind:'move',point}});}}
 }
}
