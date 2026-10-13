import {it,expect} from 'vitest';
import {createGame} from '../src/sim/world';
import {event} from '../src/sim/economy';
it('keeps event identity and kind when the location is a full entity',()=>{const s=createGame({opponents:1,difficulty:'normal',seed:2}),cap=s.entities[s.players[0].capital];s.nextEvent=40;event(s,0,'Under attack','attack',cap);expect(s.events[0].id).toBe(40);expect(s.events[0].kind).toBe('attack');expect(s.events[0].x).toBe(cap.x);expect(s.events[0]).not.toHaveProperty('queue');});
