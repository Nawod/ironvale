import type { Entity, GameState, MatchConfig, Position } from './types';
import { BUILDINGS, UNITS, COLORS } from './definitions';
import { updateVisibility } from './visibility';
import {teamStarts,validateTeams} from './teams';
import {ANIMAL_TYPES,FOOD_SOURCES} from './nature';
import type {FoodSourceType} from './types';
export function random(s:GameState):number { let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296; }
export function spawn(s:GameState,kind:Entity['kind'],type:Entity['type'],owner:number,p:Position):Entity {
 const def=kind==='building'?BUILDINGS[type as keyof typeof BUILDINGS]:kind==='unit'?UNITS[type as keyof typeof UNITS]:null;
 const e:Entity={id:s.nextId++,kind,type,owner,...p,hp:def?.hp??100,maxHp:def?.hp??100,order:{kind:'idle'},path:[],cooldown:0,progress:1,queue:[],amount:type==='farm'?900:kind==='resource'?FOOD_SOURCES[type as FoodSourceType]?.amount??500:0,stance:'aggressive',garrison:[]};s.entities[e.id]=e;return e;
}
export function createGame(config:MatchConfig):GameState {
 const n=config.opponents+1;if(!Number.isInteger(n)||n<2||n>8||config.participants&&config.participants.length!==n)throw new Error('Choose between two and eight empires.');validateTeams(config.participants);const size=n===2?96:n<=4?128:n<=6?160:192;
 const s:GameState={version:2,config:{...config},tick:0,rng:(config.seed>>>0)||1,nextId:1,nextEvent:1,size,terrain:[],entities:{},players:[],explored:Array.from({length:n},()=>Array(size*size).fill(0)),visible:Array.from({length:n},()=>Array(size*size).fill(0)),intel:Array.from({length:n},()=>({})),events:[],winner:null,paused:false};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const v=Math.sin(x*.18)+Math.cos(y*.14)+Math.sin((x+y)*.09);s.terrain.push(v>1.3?2:random(s)>.87?1:0);}
 const starts=teamStarts(config,size)??(n===2||n===4?[{x:18,y:18},{x:size-20,y:size-20},{x:size-20,y:18},{x:18,y:size-20}]:Array.from({length:n},(_,i)=>{const a=-Math.PI*.75+i*Math.PI*2/n,r=size/2-24;return{x:Math.round(size/2+Math.cos(a)*r),y:Math.round(size/2+Math.sin(a)*r)};}));
 for(let i=0;i<n;i++){
  const at=starts[i];const cap=spawn(s,'building','capital',i,at);
  s.players.push({id:i,team:config.participants?.[i].team,controller:config.participants?.[i].controller??(i===0?'human':'ai'),name:config.participants?.[i].name??['Your empire','Redcliff','Goldmere','Duskwatch','Ashford','Silverfen','Briarhold','Stormreach'][i],color:COLORS[i],alive:true,age:1,resources:{food:350,wood:450,stone:200,gold:150},capital:cap.id,weapons:0,armor:0,ai:{nextThink:20+i*10,raids:0}});
  for(let j=0;j<6;j++)spawn(s,'unit','villager',i,{x:at.x-1+(j%3)*1.3,y:at.y+4+Math.floor(j/3)*1.2});
  spawn(s,'unit','scout',i,{x:at.x+5,y:at.y+3});
  for(let j=0;j<18;j++){const a=j*Math.PI*2/18;spawn(s,'resource','wood',-1,{x:Math.round(at.x+Math.cos(a)*10),y:Math.round(at.y+Math.sin(a)*10)});}
  for(let j=0;j<4;j++){spawn(s,'resource',ANIMAL_TYPES[j],-1,{x:at.x+5+j,y:at.y-5});spawn(s,'resource','gold',-1,{x:at.x-6+j,y:at.y+5});spawn(s,'resource','stone',-1,{x:at.x-7+j,y:at.y-5});}
  for(let j=0;j<2;j++)spawn(s,'resource','berries',-1,{x:at.x-4-j*1.5,y:at.y+2});
 }
 for(let j=0;j<size*5;j++){
  const x=4+Math.floor(random(s)*(size-8)),y=4+Math.floor(random(s)*(size-8));if(starts.slice(0,n).some(p=>Math.hypot(x-p.x,y-p.y)<15))continue;
  const r=random(s),species=ANIMAL_TYPES[Math.floor(random(s)*ANIMAL_TYPES.length)];spawn(s,'resource',r<.74?'wood':r<.83?species:r<.87?'berries':r<.94?'stone':'gold',-1,{x,y});
 }
 updateVisibility(s);return s;
}
