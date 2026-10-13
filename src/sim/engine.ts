import type { GameState, Command } from './types';
import { applyCommand, updateEconomy } from './economy';
import { blockedGrid } from './navigation';
import { updateVisibility } from './visibility';
import { updateCombat,updateConquest } from './combat';
import { updateAI } from './ai';
export const command=applyCommand;
export function step(s:GameState,ticks=1,ai=true):void {
 for(let i=0;i<ticks;i++){if(s.paused||s.winner!==null)return;s.tick++;if(ai)updateAI(s);const grids=s.players.map(p=>blockedGrid(s,p.id));updateEconomy(s,.05,grids);updateCombat(s,.05,grids);updateConquest(s,.05);if(s.tick%10===0)updateVisibility(s);}
}
