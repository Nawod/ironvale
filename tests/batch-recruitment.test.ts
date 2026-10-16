import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {command,step} from '../src/sim/engine';
import {encodeSave,decodeSave} from '../src/sim/save';
import {validateCommand} from '../server/validation';
const game=()=>{const s=createGame({opponents:1,difficulty:'normal',seed:42,mapType:'lowlands'});s.players[0].resources.food=1000;return s;};
const recruit=(s:ReturnType<typeof game>,count?:unknown,building=s.players[0].capital)=>command(s,{type:'recruit',player:0,building,unit:'villager',...(count!==undefined?{count}:{})} as any);

it('pays for a complete batch up front and trains sequentially at the normal rate',()=>{
 const s=game(),b=s.entities[s.players[0].capital],before=Object.values(s.entities).filter(e=>e.owner===0&&e.type==='villager').length;
 expect(recruit(s,5)).toBeNull();expect(s.players[0].resources.food).toBe(750);expect(b.queue).toHaveLength(5);expect(b.queue.every(q=>q.total===10&&q.remaining===10&&q.cost.food===50)).toBe(true);
 step(s,210,false);expect(Object.values(s.entities).filter(e=>e.owner===0&&e.type==='villager')).toHaveLength(before+1);expect(b.queue).toHaveLength(4);expect(b.queue[1].remaining).toBe(10);
});
it('rejects an unaffordable batch without partially spending or queueing',()=>{const s=game();s.players[0].resources.food=249;expect(recruit(s,5)).toContain('resources');expect(s.players[0].resources.food).toBe(249);expect(s.entities[s.players[0].capital].queue).toHaveLength(0);});
it('reserves population across production buildings for the entire batch',()=>{
 const s=game(),other=spawn(s,'building','barracks',0,{x:30,y:30});other.queue=Array.from({length:4},()=>({kind:'unit' as const,unit:'spearman' as const,remaining:10,total:10,cost:{food:50}}));
 expect(recruit(s,5)).toContain('population');expect(s.players[0].resources.food).toBe(1000);expect(s.entities[s.players[0].capital].queue).toHaveLength(0);
});
it('rejects a batch exceeding the building queue without touching existing work',()=>{
 const s=game(),b=s.entities[s.players[0].capital];spawn(s,'building','house',0,{x:30,y:30});b.queue=Array.from({length:4},()=>({kind:'unit' as const,unit:'villager' as const,remaining:10,total:10,cost:{food:50}}));const before=structuredClone(b.queue);
 expect(recruit(s,5)).toContain('queue');expect(b.queue).toEqual(before);expect(s.players[0].resources.food).toBe(1000);
});
it('rejects malformed batch sizes in both local and online commands',()=>{
 for(const count of [0,-1,1.5,6,NaN,Infinity,'5',null]){const s=game();expect(recruit(s,count)).toBeTruthy();expect(s.players[0].resources.food).toBe(1000);expect(s.entities[s.players[0].capital].queue).toHaveLength(0);expect(()=>validateCommand({type:'recruit',building:1,unit:'villager',count})).toThrow();}
 expect(validateCommand({type:'recruit',building:1,unit:'villager',count:5})).toMatchObject({count:5,player:0});
});
it('keeps single recruitment compatible and rejects production owned by another city',()=>{const s=game();expect(recruit(s,5,s.players[1].capital)).toBeTruthy();expect(s.players[0].resources.food).toBe(1000);expect(recruit(s)).toBeNull();expect(s.entities[s.players[0].capital].queue).toHaveLength(1);expect(s.players[0].resources.food).toBe(950);});
it('retains paid batch entries and their timers through saves',()=>{const s=game();expect(recruit(s,5)).toBeNull();step(s,30,false);const restored=decodeSave(encodeSave(s));expect(restored.entities[s.players[0].capital].queue).toEqual(s.entities[s.players[0].capital].queue);expect(restored.entities[s.players[0].capital].queue).toHaveLength(5);expect(restored.players[0].resources.food).toBe(750);});
