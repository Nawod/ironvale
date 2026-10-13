import {it,expect} from 'vitest';
import {createGame} from '../src/sim/world';
import {step} from '../src/sim/engine';
import {snapshot} from '../src/sim/visibility';
import {encodeSave,decodeSave} from '../src/sim/save';
it.each([2,3,4,5,6,7,8])('creates %i equal empires with distinct colors',count=>{
 const s=createGame({opponents:(count-1) as any,difficulty:'normal',seed:42});
 expect(s.players).toHaveLength(count);expect(s.size).toBe(count===2?96:count<=4?128:count<=6?160:192);
 expect(new Set(s.players.map(p=>p.color)).size).toBe(count);
 for(const p of s.players){expect(p.resources).toEqual(s.players[0].resources);expect(Object.values(s.entities).filter(e=>e.owner===p.id&&e.type==='villager')).toHaveLength(6);expect(s.entities[p.capital]).toBeDefined();}
 expect(decodeSave(encodeSave(s))).toEqual(s);
});
it('does not run AI for a human in a nonzero seat',()=>{
 const s=createGame({opponents:1,difficulty:'hard',seed:1,participants:[{name:'Alice',controller:'human'},{name:'Bob',controller:'human'}]} as any);step(s,100);
 expect(s.players[1].controller).toBe('human');expect(s.players[1].resources.food).toBe(350);expect(Object.values(s.entities).filter(e=>e.owner===1&&e.type==='villager').every(e=>e.order.kind==='idle')).toBe(true);
 const v=snapshot(s,1);expect(v.playerId).toBe(1);expect(v.players[1].resources.food).toBe(350);expect(v.players[0].resources.food).toBe(0);
});
it('migrates a version-one save without altering its future simulation',()=>{
 const s=createGame({opponents:3,difficulty:'normal',seed:1}),old=JSON.parse(encodeSave(s));old.version=1;old.players.forEach((p:any)=>delete p.controller);const loaded=decodeSave(JSON.stringify(old));
 expect(loaded.version).toBe(2);step(s,150);step(loaded,150);expect(loaded).toEqual(s);
});
