import {expect,it} from 'vitest';
import {createGame} from '../src/sim/world';
import {FACTIONS,validFaction} from '../src/sim/factions';
import {decodeSave,encodeSave} from '../src/sim/save';
import type {MatchConfig} from '../src/sim/types';
const config:MatchConfig={opponents:7,difficulty:'normal',seed:42,faction:'british'};
it('assigns seven distinct valid AI factions in an explicit solo faction game without mutating input',()=>{
 const input=structuredClone(config),s=createGame(input);
 expect(s.players[0].faction).toBe('british');expect(s.players[0].controller).toBe('human');
 expect(s.players.slice(1).every(p=>validFaction(p.faction)&&p.faction!=='british'&&p.controller==='ai')).toBe(true);
 expect(new Set(s.players.slice(1).map(p=>p.faction)).size).toBe(7);
 expect(new Set(s.players.map(p=>p.name)).size).toBe(8);
 for(const p of s.players.slice(1))expect(p.name).toBe(`${FACTIONS[p.faction!].name} commander`);
 expect(s.config.participants?.map(p=>p.faction)).toEqual(s.players.map(p=>p.faction));expect(input).toEqual(config);expect(input.participants).toBeUndefined();
});
it('persists normalized solo factions and assigns them deterministically from the seed',()=>{
 const a=createGame(config),b=createGame(config);expect(encodeSave(a)).toBe(encodeSave(b));expect(encodeSave(decodeSave(encodeSave(a)))).toBe(encodeSave(a));
 expect(createGame({...config,seed:43}).players.slice(1).map(p=>p.faction)).not.toEqual(a.players.slice(1).map(p=>p.faction));
});
it('keeps factionless legacy games neutral and respects explicit participant choices',()=>{
 const s=createGame({opponents:1,difficulty:'normal',seed:42});expect(s.players.every(p=>p.faction===undefined)).toBe(true);expect(s.config.participants).toBeUndefined();expect(encodeSave(decodeSave(encodeSave(s)))).toBe(encodeSave(s));
 const participants=[{name:'Chosen',controller:'human' as const,faction:'kandy' as const},{name:'Legacy',controller:'ai' as const}];
 const explicit=createGame({...config,opponents:1,participants});expect(explicit.players.map(p=>p.faction)).toEqual(['kandy',undefined]);expect(explicit.config.participants).toEqual(participants);
});
