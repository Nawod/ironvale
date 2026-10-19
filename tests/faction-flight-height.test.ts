import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {attackRange,clearAttackLine} from '../src/sim/combat-tactics';
import {updateCombat} from '../src/sim/combat';
import {navigationGrids} from '../src/sim/navigation';
import {updateVisibility} from '../src/sim/visibility';
import {decodeSave,encodeSave} from '../src/sim/save';
import {step} from '../src/sim/engine';
import {TERRAIN} from '../src/sim/terrain';
import * as factions from '../src/sim/factions';
const arena=()=>{const s=createGame({opponents:1,difficulty:'normal',seed:42,faction:'ravana'});s.terrain.fill(0);s.elevation!.fill(0);return s;};
function ridge(s:ReturnType<typeof arena>,height:number){s.terrain[40*s.size+43]=TERRAIN.mountain;for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++)s.elevation![(40+dy)*(s.size+1)+43+dx]=height;}
it('uses the shared three-unit flight height and keeps faction champion names coherent',()=>{
 const s=arena(),air=spawn(s,'unit','danduMonara',0,{x:40,y:40}),ground=spawn(s,'unit','archer',1,{x:41,y:40});
 expect(factions.flightHeight?.(air)).toBe(3);expect(factions.flightHeight?.(ground)).toBe(0);
 expect(factions.unitName('champion',s.players[0])).toBe('Rakshasa giant');expect(factions.unitStats('champion',s.players[0]).name).toBe('Rakshasa giant');
 expect(factions.unitName('champion',{faction:'anuradhapura'})).toBe('Yodha champion');
});
it('shoots aircraft above a low ridge while a high ridge still intercepts anti-air shots',()=>{
 const s=arena(),bow=spawn(s,'unit','archer',1,{x:40.5,y:40.5}),air=spawn(s,'unit','danduMonara',0,{x:46.5,y:40.5}),ground=spawn(s,'unit','spearman',0,{x:46.5,y:40.5});ridge(s,1.8);
 expect(clearAttackLine(s,bow,air)).toBe(true);expect(clearAttackLine(s,bow,ground)).toBe(false);ridge(s,6);expect(clearAttackLine(s,bow,air)).toBe(false);expect(clearAttackLine(s,air,bow)).toBe(false);
});
it('includes flight altitude in downhill range without changing flat ground arrows',()=>{
 const s=arena(),air=spawn(s,'unit','danduMonara',0,{x:40.5,y:40.5}),bow=spawn(s,'unit','archer',1,{x:46.5,y:40.5});
 expect(attackRange(s,air,bow).heightAdvantage).toBe(3);expect(attackRange(s,air,bow).bonus).toBeCloseTo(.9);expect(attackRange(s,bow,air).bonus).toBe(0);
 const foot=spawn(s,'unit','spearman',0,{x:46.5,y:42.5});expect(attackRange(s,bow,foot)).toMatchObject({base:6,bonus:0,max:6,heightAdvantage:0});
});
it('records actual target flight height and replays it deterministically through saves',()=>{
 const s=arena(),bow=spawn(s,'unit','archer',1,{x:40.5,y:40.5}),air=spawn(s,'unit','danduMonara',0,{x:46.5,y:40.5});bow.stance=air.stance='hold';air.cooldown=100;updateVisibility(s);updateCombat(s,.05,navigationGrids(s));
 expect(bow.attackFx?.height).toBe(3);const restored=decodeSave(encodeSave(s));expect(restored.entities[bow.id].attackFx).toEqual(bow.attackFx);step(s,10,false);step(restored,10,false);expect(encodeSave(restored)).toBe(encodeSave(s));
});
it('keeps legacy attack effects valid and rejects malformed optional height offsets',()=>{
 const s=arena(),bow=spawn(s,'unit','archer',0,{x:40.5,y:40.5});bow.attackFx={x:42,y:40,tick:0};expect(()=>decodeSave(encodeSave(s))).not.toThrow();
 for(const height of [-1,3.1,4,'3',null,Infinity]){(bow.attackFx as any).height=height;expect(()=>decodeSave(encodeSave(s))).toThrow(/height|effect/i);}
 bow.attackFx.height=0;expect(()=>decodeSave(encodeSave(s))).not.toThrow();
});
