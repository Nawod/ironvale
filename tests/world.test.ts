import { describe, it, expect } from 'vitest';
import { createGame } from '../src/sim/world';
describe('seeded world', () => {
 it('starts two equal empires with six villagers and one scout each', () => {
  const s = createGame({ opponents: 1, difficulty: 'normal', seed: 42 });
  expect(s.size).toBe(96); expect(s.players).toHaveLength(2);
  expect(s.players[0].resources).toEqual({food:350,wood:450,stone:200,gold:150});
  for (const p of s.players) { const units=Object.values(s.entities).filter(e=>e.owner===p.id&&e.kind==='unit'); expect(units.filter(e=>e.type==='villager')).toHaveLength(6); expect(units.filter(e=>e.type==='scout')).toHaveLength(1); }
 });
 it('recreates the same four-player world from a seed',()=>{ const c={opponents:3 as const,difficulty:'hard' as const,seed:8}; const a=createGame(c),b=createGame(c); expect(a.players).toHaveLength(4); expect(a.size).toBe(128); expect(a).toEqual(b); });
});
