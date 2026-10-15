import type {MatchConfig,Player,Position} from './types';
type Diplomacy={players:Pick<Player,'id'|'team'>[]};
export const MAX_TEAM_SIZE=4;
export function allied(s:Diplomacy,a:number,b:number):boolean {
 if(a<0||b<0)return false;
 return a===b||s.players[a]?.team!==undefined&&s.players[a].team===s.players[b]?.team;
}
export const hostile=(s:Diplomacy,a:number,b:number):boolean=>a>=0&&b>=0&&!allied(s,a,b);
export const allianceKey=(p:Pick<Player,'id'|'team'>):string=>p.team===undefined?`player:${p.id}`:`team:${p.team}`;
export function validateTeams(participants:MatchConfig['participants']):void{
 if(!participants?.some(p=>p.team!==undefined))return;
 const counts=new Map<number,number>();
 for(const p of participants){if(!Number.isInteger(p.team)||p.team!<0||p.team!>7)throw new Error('Choose a team for every player.');const count=(counts.get(p.team!)??0)+1;if(count>MAX_TEAM_SIZE)throw new Error('A team can have at most four players.');counts.set(p.team!,count);}
 if(counts.size<2)throw new Error('Choose at least two opposing teams.');
}
export function teamStarts(config:MatchConfig,size:number):Position[]|undefined{
 if(!config.participants?.some(p=>p.team!==undefined))return;
 const teams=[...new Set(config.participants.map(p=>p.team!))].sort((a,b)=>a-b),result:Position[]=[];
 for(const [index,team] of teams.entries()){
  const members=config.participants.map((p,i)=>p.team===team?i:-1).filter(i=>i>=0),angle=-Math.PI*.75+index*Math.PI*2/teams.length,radius=size/2-27;
  const offsets=members.length===1?[[0,0]]:members.length===2?[[-16,0],[16,0]]:members.length===3?[[-16,-9.24],[16,-9.24],[0,18.48]]:[[-16,-16],[16,-16],[-16,16],[16,16]];
  const rotated=offsets.map(([x,y])=>({x:x*Math.cos(angle)-y*Math.sin(angle),y:x*Math.sin(angle)+y*Math.cos(angle)}));
  const center={x:Math.max(17-Math.min(...rotated.map(p=>p.x)),Math.min(size-20-Math.max(...rotated.map(p=>p.x)),size/2+Math.cos(angle)*radius)),y:Math.max(17-Math.min(...rotated.map(p=>p.y)),Math.min(size-20-Math.max(...rotated.map(p=>p.y)),size/2+Math.sin(angle)*radius))};
  for(const [slot,id] of members.entries()){
   // Move the entire cluster inside the border, preserving spacing between allies.
   result[id]={x:Math.round(center.x+rotated[slot].x),y:Math.round(center.y+rotated[slot].y)};
  }
 }
 return result;
}
