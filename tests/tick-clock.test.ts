import {it,expect} from 'vitest';
import {TickClock} from '../server/tick-clock';
it('catches up delayed timer callbacks without slowing simulation time',()=>{
 const clock=new TickClock(0);let ticks=0;
 for(let now=63;now<5000;now+=63)ticks+=clock.due(now);
 ticks+=clock.due(5000);expect(ticks).toBe(100);expect(clock.delay(5000)).toBe(50);
});
it('bounds work per callback while preserving moderate delays',()=>{
 const clock=new TickClock(0);expect(clock.due(350)).toBe(5);expect(clock.delay(350)).toBe(1);expect(clock.due(350)).toBe(2);expect(clock.due(350)).toBe(0);
});
