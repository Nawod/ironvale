import { describe, expect, it } from 'vitest';
import { updateAI } from '../src/sim/ai';
import { command, step } from '../src/sim/engine';
import { createGame, spawn } from '../src/sim/world';
import { capacity, population } from '../src/sim/visibility';
import type { Command, Difficulty, GameState } from '../src/sim/types';

const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];

// The same seat and geometry isolate controller privileges from map/path differences.
function pair(difficulty: Difficulty): [GameState, GameState] {
  const human = createGame({ opponents: 1, difficulty, seed: 42 });
  const cap = human.players[0].capital;
  const worker = Object.values(human.entities).find(e => e.owner === 0 && e.type === 'villager')!;
  for (const e of Object.values(human.entities)) {
    if (e.id !== cap && e.id !== worker.id && e.id !== human.players[1].capital) delete human.entities[e.id];
  }
  worker.x = 22.5;
  worker.y = 19.5;
  human.players[0].resources = { food: 1000, wood: 1000, gold: 1000, stone: 1000 };
  human.visible[0].fill(1);
  human.explored[0].fill(1);
  const ai = structuredClone(human);
  ai.players[0].controller = 'ai';
  return [human, ai];
}

function submitBoth(states: GameState[], make: (s: GameState) => Command): (string | null)[] {
  return states.map(s => command(s, make(s)));
}

function worker(s: GameState) {
  return Object.values(s.entities).find(e => e.owner === 0 && e.type === 'villager')!;
}

function identical(states: [GameState, GameState]): void {
  const comparable = structuredClone(states[1]);
  comparable.players[0].controller = 'human';
  expect(comparable).toEqual(states[0]);
}

describe.each(difficulties)('%s: human and AI share authoritative economy rules', difficulty => {
  it('charges a spearman once, rejects an unaffordable follow-up, and waits 12 seconds', () => {
    const states = pair(difficulty);
    for (const s of states) {
      s.players[0].resources = { food: 45, wood: 20, gold: 0, stone: 0 };
      spawn(s, 'building', 'barracks', 0, { x: 26, y: 18 });
    }
    const recruit = (s: GameState): Command => ({ type: 'recruit', player: 0, building: s.nextId - 1, unit: 'spearman' });
    expect(submitBoth(states, recruit)).toEqual([null, null]);
    for (const s of states) {
      expect(s.players[0].resources).toEqual({ food: 0, wood: 0, gold: 0, stone: 0 });
      expect(s.entities[s.nextId - 1].queue[0]).toMatchObject({ remaining: 12, total: 12 });
    }
    expect(submitBoth(states, recruit).every(Boolean)).toBe(true);
    for (const s of states) {
      step(s, 239, false);
      expect(Object.values(s.entities).filter(e => e.type === 'spearman')).toHaveLength(0);
      step(s, 2, false); // Floating-point countdown may require the next 50 ms tick.
      expect(Object.values(s.entities).filter(e => e.type === 'spearman')).toHaveLength(1);
      expect(s.players[0].resources.food).toBe(0);
    }
    identical(states);
  });

  it('reserves population across separate production queues before accepting another purchase', () => {
    const states = pair(difficulty);
    for (const s of states) {
      spawn(s, 'building', 'barracks', 0, { x: 26, y: 18 });
      for (let n = 0; n < 7; n++) spawn(s, 'unit', 'villager', 0, { x: 15 + n, y: 24 });
      for (let n = 0; n < 7; n++) {
        const building = n % 2 ? s.players[0].capital : s.nextId - 8;
        expect(command(s, { type: 'recruit', player: 0, building, unit: n % 2 ? 'villager' : 'spearman' })).toBeNull();
      }
      const before = structuredClone(s.players[0].resources);
      expect(command(s, { type: 'recruit', player: 0, building: s.players[0].capital, unit: 'villager' })).toMatch(/population/i);
      expect(s.players[0].resources).toEqual(before);
      expect(capacity(s, 0)).toBe(15);
      step(s, 1200, false);
      expect(population(s, 0)).toBe(15);
    }
    identical(states);
  });

  it('rejects foreign, unfinished and age-locked production without spending', () => {
    const states = pair(difficulty);
    for (const s of states) {
      const barracks = spawn(s, 'building', 'barracks', 0, { x: 26, y: 18 });
      const before = structuredClone(s.players[0].resources);
      barracks.progress = .5;
      expect(command(s, { type: 'recruit', player: 0, building: barracks.id, unit: 'spearman' })).toBeTruthy();
      barracks.progress = 1;
      expect(command(s, { type: 'recruit', player: 0, building: barracks.id, unit: 'swordsman' })).toBeTruthy();
      expect(command(s, { type: 'recruit', player: 0, building: s.players[1].capital, unit: 'villager' })).toBeTruthy();
      expect(s.players[0].resources).toEqual(before);
      expect(barracks.queue).toHaveLength(0);
    }
    identical(states);
  });

  it('rejects unaffordable construction and research atomically', () => {
    const states = pair(difficulty);
    for (const s of states) {
      s.players[0].resources.wood = 49;
      const beforeBuild = structuredClone(s);
      expect(command(s, { type: 'build', player: 0, building: 'house', point: { x: 24, y: 18 }, workers: [worker(s).id] })).toMatch(/resources/i);
      expect(s).toEqual(beforeBuild);
      spawn(s, 'building', 'storage', 0, { x: 26, y: 18 });
      spawn(s, 'building', 'barracks', 0, { x: 29, y: 18 });
      s.players[0].resources.food = 399;
      const beforeResearch = structuredClone(s);
      expect(command(s, { type: 'research', player: 0, building: s.players[0].capital, research: 'age' })).toMatch(/resources/i);
      expect(s).toEqual(beforeResearch);
    }
    identical(states);
  });

  it('rejects a ninth queued recruit without charging when housing remains available', () => {
    const states = pair(difficulty);
    for (const s of states) {
      spawn(s, 'building', 'house', 0, { x: 26, y: 18 });
      for (let n = 0; n < 8; n++) expect(command(s, { type: 'recruit', player: 0, building: s.players[0].capital, unit: 'villager' })).toBeNull();
      expect(s.players[0].resources.food).toBe(600);
      expect(command(s, { type: 'recruit', player: 0, building: s.players[0].capital, unit: 'villager' })).toMatch(/queue is full/i);
      expect(s.players[0].resources.food).toBe(600);
      expect(s.entities[s.players[0].capital].queue).toHaveLength(8);
    }
    identical(states);
  });

  it('pays a house once and duplicate worker IDs cannot accelerate its 12 second build', () => {
    const states = pair(difficulty);
    expect(submitBoth(states, s => ({ type: 'build', player: 0, building: 'house', point: { x: 24, y: 18 }, workers: [worker(s).id, worker(s).id] }))).toEqual([null, null]);
    for (const s of states) {
      const house = s.entities[s.nextId - 1];
      expect(s.players[0].resources.wood).toBe(950);
      step(s, 120, false);
      expect(house.progress).toBeCloseTo(.5, 9);
      expect(s.players[0].resources.wood).toBe(950);
      step(s, 119, false);
      expect(house.progress).toBeLessThan(1);
      step(s, 2, false);
      expect(house.progress).toBe(1);
    }
    identical(states);
  });

  it('counts actual adjacent builders, allowing the same paid teamwork speedup', () => {
    const states = pair(difficulty);
    for (const s of states) {
      const second = spawn(s, 'unit', 'villager', 0, { x: 23, y: 20.5 });
      expect(command(s, { type: 'build', player: 0, building: 'house', point: { x: 24, y: 18 }, workers: [worker(s).id, second.id] })).toBeNull();
      const house = s.entities[s.nextId - 1];
      step(s, 119, false);
      expect(house.progress).toBeLessThan(1);
      step(s, 2, false);
      expect(house.progress).toBe(1);
      expect(s.players[0].resources.wood).toBe(950);
    }
    identical(states);
  });

  it('requires completed prerequisites, charges age research once and waits 45 seconds', () => {
    const states = pair(difficulty);
    for (const s of states) {
      const request: Command = { type: 'research', player: 0, building: s.players[0].capital, research: 'age' };
      expect(command(s, request)).toMatch(/Build/i);
      spawn(s, 'building', 'storage', 0, { x: 26, y: 18 });
      const barracks = spawn(s, 'building', 'barracks', 0, { x: 29, y: 18 });
      barracks.progress = .9;
      expect(command(s, request)).toMatch(/Build/i);
      expect(s.players[0].resources.food).toBe(1000);
      barracks.progress = 1;
      expect(command(s, request)).toBeNull();
      expect(s.players[0].resources).toEqual({ food: 600, wood: 1000, gold: 850, stone: 1000 });
      expect(command(s, request)).toMatch(/already/i);
      step(s, 899, false);
      expect(s.players[0].age).toBe(1);
      step(s, 2, false);
      expect(s.players[0].age).toBe(2);
    }
    identical(states);
  });

  it('charges smithy research once, waits 30 seconds and rejects another duplicate', () => {
    const states = pair(difficulty);
    for (const s of states) {
      s.players[0].age = 2;
      const smithy = spawn(s, 'building', 'smithy', 0, { x: 26, y: 18 });
      const request: Command = { type: 'research', player: 0, building: smithy.id, research: 'weapons' };
      expect(command(s, request)).toBeNull();
      expect(s.players[0].resources).toEqual({ food: 900, wood: 1000, gold: 920, stone: 1000 });
      expect(command(s, request)).toBeTruthy();
      step(s, 599, false);
      expect(s.players[0].weapons).toBe(0);
      step(s, 2, false);
      expect(s.players[0].weapons).toBe(1);
      expect(command(s, request)).toBeTruthy();
    }
    identical(states);
  });

  it('conserves an exhausted wood source through carry and deposit at 2.8 units per second', () => {
    const states = pair(difficulty);
    for (const s of states) {
      const source = spawn(s, 'resource', 'wood', -1, { x: 23.5, y: 19.5 });
      source.amount = 1;
      expect(command(s, { type: 'order', player: 0, ids: [worker(s).id, worker(s).id], order: { kind: 'gather', target: source.id } })).toBeNull();
      step(s, 7, false);
      expect(source.amount).toBeCloseTo(.02, 8);
      expect(worker(s).carry?.amount).toBeCloseTo(.98, 8);
      expect(s.players[0].resources.wood).toBe(1000);
      step(s, 2, false);
      expect(source.amount).toBe(0);
      expect(s.players[0].resources.wood).toBe(1001);
      expect(worker(s).carry).toBeUndefined();
      step(s, 10, false);
      expect(s.players[0].resources.wood).toBe(1001);
    }
    identical(states);
  });

  it('harvests food at 3.6 per second and pays 35 wood once to replant a depleted farm', () => {
    const states = pair(difficulty);
    for (const s of states) {
      const farm = spawn(s, 'building', 'farm', 0, { x: 23.5, y: 19.5 });
      farm.amount = 0;
      expect(command(s, { type: 'order', player: 0, ids: [worker(s).id], order: { kind: 'gather', target: farm.id } })).toBeNull();
      step(s, 1, false);
      expect(s.players[0].resources.wood).toBe(965);
      expect(worker(s).carry?.resource).toBe('food');
      expect(worker(s).carry?.amount).toBeCloseTo(.18, 9);
      expect(farm.amount).toBeCloseTo(899.82, 8);
      step(s, 9, false);
      expect(s.players[0].resources.wood).toBe(965);
      expect(worker(s).carry?.amount).toBeCloseTo(1.8, 8);
    }
    identical(states);
  });

  it('cannot obtain food from a depleted farm when its replant cost is unaffordable', () => {
    const states = pair(difficulty);
    for (const s of states) {
      const farm = spawn(s, 'building', 'farm', 0, { x: 23.5, y: 19.5 });
      farm.amount = 0;
      s.players[0].resources.wood = 34;
      expect(command(s, { type: 'order', player: 0, ids: [worker(s).id], order: { kind: 'gather', target: farm.id } })).toBeNull();
      step(s, 50, false);
      expect(s.players[0].resources).toEqual({ food: 1000, wood: 34, gold: 1000, stone: 1000 });
      expect(farm.amount).toBe(0);
      expect(worker(s).carry).toBeUndefined();
    }
    identical(states);
  });

  it('AI planning spends the same stock when explicitly run for an identical human seat', () => {
    const states = pair(difficulty);
    for (const s of states) {
      s.players[1].ai.nextThink = Number.MAX_SAFE_INTEGER;
      s.players[0].ai.nextThink = 0;
      updateAI(s, true);
      expect(s.players[0].resources).toEqual({ food: 935, wood: 920, gold: 1000, stone: 1000 });
      expect(Object.values(s.entities).filter(e => e.owner === 0 && e.type === 'storage')).toHaveLength(1);
      expect(s.entities[s.players[0].capital].queue[0]).toMatchObject({ unit: 'scout', remaining: 14 });
    }
    identical(states);
  });
});
