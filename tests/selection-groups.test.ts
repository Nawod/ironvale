import {expect,it} from 'vitest';
import {selectionGroups} from '../src/ui/selection';
import {createGame,spawn} from '../src/sim/world';

it('groups an army by type, with distinct IDs and current combined health',()=>{
 const s=createGame({opponents:1,difficulty:'easy',seed:42}),a=spawn(s,'unit','archer',0,{x:22,y:22}),b=spawn(s,'unit','archer',0,{x:23,y:22}),c=spawn(s,'unit','spearman',0,{x:24,y:22});a.hp=30;
 const groups=selectionGroups([a,b,c,a],0);expect(groups).toHaveLength(2);expect(groups.find(g=>g.type==='archer')).toMatchObject({ids:[a.id,b.id],count:2,hp:105,maxHp:150});expect(selectionGroups([c,b,a],0).map(g=>g.type)).toEqual(groups.map(g=>g.type));
});
it('never offers control of another city, a ghost, a garrison or a destroyed unit',()=>{
 const s=createGame({opponents:1,difficulty:'easy',seed:42}),unit=spawn(s,'unit','archer',0,{x:22,y:22}),enemy={...unit,id:999,owner:1},ghost={...unit,id:998,ghost:true},dead={...unit,id:997,hp:0},inside={...unit,id:996,garrisoned:12};
 expect(selectionGroups([unit,enemy,ghost,dead,inside,s.entities[s.players[0].capital]],0).flatMap(g=>g.ids)).toEqual([unit.id]);
});
