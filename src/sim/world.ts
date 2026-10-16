import type { Entity, GameState, MatchConfig, Position } from './types';
import { BUILDINGS, UNITS, COLORS } from './definitions';
import { updateVisibility } from './visibility';
import {teamStarts,validateTeams} from './teams';
import {ANIMAL_TYPES,FOOD_SOURCES} from './nature';
import type {FoodSourceType} from './types';
import {isBlockedTerrain,TERRAIN} from './terrain';
import {battlefieldSize,generateBattlefield} from './map-generation';
export function random(s:GameState):number { let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296; }
export function spawn(s:GameState,kind:Entity['kind'],type:Entity['type'],owner:number,p:Position):Entity {
 const def=kind==='building'?BUILDINGS[type as keyof typeof BUILDINGS]:kind==='unit'?UNITS[type as keyof typeof UNITS]:null;
 const e:Entity={id:s.nextId++,kind,type,owner,...p,hp:def?.hp??100,maxHp:def?.hp??100,order:{kind:'idle'},path:[],cooldown:0,progress:1,queue:[],amount:type==='farm'?900:kind==='resource'?FOOD_SOURCES[type as FoodSourceType]?.amount??500:0,stance:'aggressive',garrison:[]};s.entities[e.id]=e;return e;
}
export function createGame(config:MatchConfig):GameState {
 if(config.mapType!==undefined&&config.mapType!=='lowlands'&&config.mapType!=='riverlands')throw new Error('Choose a valid map type.');
 if(config.zombies!==undefined&&typeof config.zombies!=='boolean')throw new Error('Choose a valid zombie mode setting.');
 if(config.mapSize!==undefined&&!['standard','large','huge'].includes(config.mapSize))throw new Error('Choose a valid map size.');
 if(config.worldGeneration!==undefined&&config.worldGeneration!==2)throw new Error('Choose a valid world generation version.');
 const n=config.opponents+1;if(!Number.isInteger(n)||n<2||n>8||config.participants&&config.participants.length!==n)throw new Error('Choose between two and eight empires.');validateTeams(config.participants);const size=battlefieldSize(n,config.mapSize);
 const s:GameState={version:2,config:{...config,mapSize:config.mapSize??'large',worldGeneration:2},tick:0,rng:(config.seed>>>0)||1,nextId:1,nextEvent:1,size,terrain:[],entities:{},players:[],explored:Array.from({length:n},()=>Array(size*size).fill(0)),visible:Array.from({length:n},()=>Array(size*size).fill(0)),intel:Array.from({length:n},()=>({})),events:[],winner:null,paused:false};
 const starts=teamStarts(config,size)??(n===2||n===4?[{x:18,y:18},{x:size-20,y:size-20},{x:size-20,y:18},{x:18,y:size-20}]:Array.from({length:n},(_,i)=>{const a=-Math.PI*.75+i*Math.PI*2/n,r=size/2-24;return{x:Math.round(size/2+Math.cos(a)*r),y:Math.round(size/2+Math.sin(a)*r)};}));
 Object.assign(s,generateBattlefield(size,config.seed,config.mapType??'lowlands',starts.slice(0,n)));
 for(let i=0;i<n;i++){
  const at=starts[i];const cap=spawn(s,'building','capital',i,at);
  s.players.push({id:i,team:config.participants?.[i].team,controller:config.participants?.[i].controller??(i===0?'human':'ai'),name:config.participants?.[i].name??['Your empire','Redcliff','Goldmere','Duskwatch','Ashford','Silverfen','Briarhold','Stormreach'][i],color:COLORS[i],alive:true,age:1,resources:{food:350,wood:450,stone:200,gold:150},capital:cap.id,weapons:0,armor:0,ai:{nextThink:20+i*10,raids:0}});
  for(let j=0;j<6;j++)spawn(s,'unit','villager',i,{x:at.x-1+(j%3)*1.3,y:at.y+4+Math.floor(j/3)*1.2});
  spawn(s,'unit','scout',i,{x:at.x+5,y:at.y+3});
  for(let j=0;j<18;j++){const a=j*Math.PI*2/18;spawn(s,'resource','wood',-1,{x:Math.round(at.x+Math.cos(a)*10),y:Math.round(at.y+Math.sin(a)*10)});}
  for(let j=0;j<4;j++){spawn(s,'resource',ANIMAL_TYPES[j],-1,{x:at.x+5+j,y:at.y-5});spawn(s,'resource','gold',-1,{x:at.x-6+j,y:at.y+5});spawn(s,'resource','stone',-1,{x:at.x-7+j,y:at.y-5});}
  for(let j=0;j<2;j++)spawn(s,'resource','berries',-1,{x:at.x-4-j*1.5,y:at.y+2});
 }
 const occupied=new Set(Object.values(s.entities).map(e=>`${Math.floor(e.x)},${Math.floor(e.y)}`));
 for(let j=0;j<size*size*.12;j++){
  const x=4+Math.floor(random(s)*(size-8)),y=4+Math.floor(random(s)*(size-8)),tile=s.terrain[y*size+x],key=`${x},${y}`;
  if(isBlockedTerrain(tile)||tile===TERRAIN.ford||tile===TERRAIN.bridge||occupied.has(key)||starts.slice(0,n).some(p=>Math.hypot(x-p.x,y-p.y)<18))continue;
  const r=random(s),species=ANIMAL_TYPES[Math.floor(random(s)*ANIMAL_TYPES.length)];
  // Trees favor the coherent woodland patches produced by the same map seed.
  if(r<.74&&tile!==TERRAIN.woodland&&random(s)>.08)continue;
  spawn(s,'resource',r<.74?'wood':r<.83?species:r<.87?'berries':r<.94?'stone':'gold',-1,{x,y});occupied.add(key);
 }
 updateVisibility(s);return s;
}
