import type { GameState, Command } from './types';
import { applyCommand, updateEconomy } from './economy';
import { navigationGrids } from './navigation';
import {separateUnits} from './physics';
import { updateVisibility } from './visibility';
import { updateCombat,updateConquest } from './combat';
import {updateWildlife} from './wildlife';
import { updateAI } from './ai';
import {updateZombies} from './zombies';
export const command=applyCommand;
export function step(s:GameState,ticks=1,ai=true):void {
 for(let i=0;i<ticks;i++){if(s.paused||s.winner!==null)return;s.tick++;if(ai)updateAI(s);const grids=navigationGrids(s);updateWildlife(s,.05,grids[s.players.length]);updateEconomy(s,.05,grids);updateZombies(s,.05,grids[s.players.length]);updateCombat(s,.05,grids);separateUnits(s,grids);updateConquest(s,.05);if(s.tick%10===0)updateVisibility(s);}
}
