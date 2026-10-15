import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {snapshot,updateVisibility} from '../src/sim/visibility';
it('remembers a hidden moved building until its old empty location is scouted again',()=>{
 const s=createGame({opponents:1,difficulty:'normal',seed:42});const scout=spawn(s,'unit','scout',0,{x:30,y:30}),house=spawn(s,'building','house',1,{x:31,y:31});
 updateVisibility(s);scout.x=18;scout.y=18;updateVisibility(s);house.x=60;house.y=60;updateVisibility(s);
 expect(snapshot(s,0).entities.find(e=>e.id===house.id)).toMatchObject({x:31,y:31,ghost:true});
 scout.x=30;scout.y=30;updateVisibility(s);expect(snapshot(s,0).entities.find(e=>e.id===house.id)).toBeUndefined();
 scout.x=60;scout.y=60;updateVisibility(s);expect(snapshot(s,0).entities.find(e=>e.id===house.id)).toMatchObject({x:60,y:60});
});
