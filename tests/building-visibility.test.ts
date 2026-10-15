import {it,expect} from 'vitest';
import {createGame} from '../src/sim/world';
import {snapshot,updateVisibility} from '../src/sim/visibility';

it('shows observed building stages while retaining the last stage under fog',()=>{
 const s=createGame({opponents:1,difficulty:'normal',seed:42}),cap=s.entities[s.players[1].capital];
 s.players[1].age=2;
 const scout=Object.values(s.entities).find(e=>e.owner===0&&e.kind==='unit')!;scout.x=cap.x;scout.y=cap.y;updateVisibility(s);
 expect(snapshot(s,0).entities.find(e=>e.id===cap.id)?.visualAge).toBe(2);
 expect(snapshot(s,0).players[1].age).toBe(1);
 scout.x=10;scout.y=10;updateVisibility(s);s.players[1].age=3;updateVisibility(s);
 const remembered=snapshot(s,0).entities.find(e=>e.id===cap.id)!;
 expect(remembered.ghost).toBe(true);expect(remembered.visualAge).toBe(2);
 scout.x=cap.x;scout.y=cap.y;updateVisibility(s);
 expect(snapshot(s,0).entities.find(e=>e.id===cap.id)?.visualAge).toBe(3);
});
