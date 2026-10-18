import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {updateWildlife} from '../src/sim/wildlife';
import {encodeSave,decodeSave} from '../src/sim/save';

it('spreads initial wildlife path requests across ticks and preserves saved continuation',()=>{
 const s=createGame({opponents:1,difficulty:'easy',seed:42});s.entities={};s.terrain.fill(0);s.elevation?.fill(0);
 for(let i=0;i<100;i++)spawn(s,'resource','deer',-1,{x:30+i%10*3,y:30+Math.floor(i/10)*3});
 const grid=new Uint8Array(s.size*s.size),before=Object.values(s.entities).map(e=>[e.x,e.y]);s.tick=1;updateWildlife(s,.05,grid);
 expect(Object.values(s.entities).filter(e=>e.order.kind==='move').length).toBeLessThanOrEqual(5);
 for(let i=2;i<45;i++){s.tick=i;updateWildlife(s,.05,grid);}
 expect(Object.values(s.entities).some((e,i)=>e.x!==before[i][0]||e.y!==before[i][1])).toBe(true);
 // Restore normal capital ownership so this controlled arena is saveable.
 for(const p of s.players)p.alive=false;const copy=decodeSave(encodeSave(s));
 for(let i=0;i<40;i++){s.tick++;copy.tick++;updateWildlife(s,.05,grid);updateWildlife(copy,.05,grid);}expect(copy).toEqual(s);
});
