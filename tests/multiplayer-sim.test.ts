import {it,expect} from 'vitest';
import {createGame} from '../src/sim/world';
import {step} from '../src/sim/engine';
import {snapshot,updateVisibility} from '../src/sim/visibility';
import {encodeSave,decodeSave} from '../src/sim/save';
import {applyCommand} from '../src/sim/economy';
it('keeps last-seen resource amounts while enemy gathering occurs outside sight',()=>{
 const s=createGame({opponents:1,difficulty:'normal',seed:1});const resource=Object.values(s.entities).find(e=>e.kind==='resource'&&s.visible[0][Math.floor(e.y)*s.size+Math.floor(e.x)])!;const amount=resource.amount;
 for(const e of Object.values(s.entities))if(e.owner===0){e.x=70;e.y=15;}
 updateVisibility(s);resource.amount=3;
 expect(snapshot(s,0).entities.find(e=>e.id===resource.id)?.amount).toBe(amount);
});
it('rejects construction orders against units and completed buildings without free repairs',()=>{
 const s=createGame({opponents:1,difficulty:'normal',seed:1});const w=Object.values(s.entities).find(e=>e.owner===0&&e.type==='villager')!,cap=s.entities[s.players[0].capital];cap.hp-=100;
 for(const kind of ['build','repair'] as const)expect(applyCommand(s,{type:'order',player:0,ids:[w.id],order:{kind,target:w.id}})).toBeTruthy();
 expect(applyCommand(s,{type:'order',player:0,ids:[w.id],order:{kind:'build',target:cap.id}})).toBeTruthy();
 const hp=cap.hp;expect(()=>step(s,1)).not.toThrow();expect(cap.hp).toBe(hp);
});
it.each([2,3,4,5,6,7,8])('creates %i equal empires with distinct colors',count=>{
 const s=createGame({opponents:(count-1) as any,difficulty:'normal',seed:42});
 expect(s.players).toHaveLength(count);expect(s.size).toBe(count===2?160:count<=4?192:count<=6?224:256);
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
