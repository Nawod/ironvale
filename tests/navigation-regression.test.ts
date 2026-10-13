import {it,expect} from 'vitest';
import {createGame} from '../src/sim/world';
import {pathfind,blockedGrid} from '../src/sim/navigation';
it('finds a reachable long diagonal route across the four-empire map',()=>{
 const s=createGame({opponents:3,difficulty:'hard',seed:42}),grid=blockedGrid(s,2);
 const route=pathfind(s,{x:118.26,y:53.5},{x:8,y:8},2,grid);
 expect(route.length).toBeGreaterThan(100);
 expect(route.at(-1)).toEqual({x:8.5,y:8.5});
 expect(route.every(p=>!grid[Math.floor(p.y)*s.size+Math.floor(p.x)])).toBe(true);
});
