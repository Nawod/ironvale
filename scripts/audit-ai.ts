import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { BUILDINGS, UNITS } from '../src/sim/definitions';
import { step } from '../src/sim/engine';
import { createGame } from '../src/sim/world';
import type { BuildingType, Difficulty, Entity, QueueItem, Resource, Resources } from '../src/sim/types';

// Passive observer: runs the ordinary authoritative engine with its normal AI.
// It does not replace applyCommand, inject stock, alter timers or pause opponents.
const duration = Math.max(30, Number(process.argv[2]) || 180);
const seed = Number(process.argv[3]) || 42;
const requested = process.argv[4];
const difficulties: Difficulty[] = requested && ['easy', 'normal', 'hard'].includes(requested)
  ? [requested as Difficulty] : ['easy', 'normal', 'hard'];
const resources: Resource[] = ['food', 'wood', 'stone', 'gold'];
const empty = (): Resources => ({ food: 0, wood: 0, stone: 0, gold: 0 });
const add = (target: Resources, values: Partial<Resources>, multiplier = 1) => {
  for (const r of resources) target[r] += (values[r] ?? 0) * multiplier;
};
const rounded = (stock: Resources) => Object.fromEntries(resources.map(r => [r, Math.round(stock[r] * 1e6) / 1e6]));
type Purchase = { tick: number; seconds: number; building: number; kind: string; type: string; cost: Partial<Resources>; totalSeconds?: number; stockAtEndTick: Resources };
const sourceHashes = Object.fromEntries(['ai', 'economy', 'engine', 'definitions', 'world', 'nature', 'wildlife', 'navigation'].map(name => {
  const file = `src/sim/${name}.ts`;
  return [file, createHash('sha256').update(readFileSync(file)).digest('hex')];
}));

mkdirSync('test-results', { recursive: true });
const reports = [];
for (const difficulty of difficulties) {
  const s = createGame({ opponents: 1, difficulty, seed });
  const player = s.players[1], start = structuredClone(player.resources), started = performance.now();
  const spent = empty(), gathered = empty(), replants = empty(), residual = empty();
  const purchases: Purchase[] = [], first: Record<string, number> = {};
  const knownEntities = new Set(Object.keys(s.entities).map(Number));
  const knownQueues = new WeakSet<QueueItem>();
  const unitOrigins = new Map<string, number[]>();
  const snapshots: unknown[] = [], anomalies: unknown[] = [];
  let minimumStock = Math.min(...Object.values(player.resources));
  for (let n = 0; n < duration * 20 && s.winner === null; n++) {
    const beforeStock = structuredClone(player.resources);
    const beforeCarries = new Map(Object.values(s.entities).filter(e => e.owner === player.id && e.carry).map(e => [e.id, structuredClone(e.carry!)]));
    const beforeFarms = new Map(Object.values(s.entities).filter(e => e.owner === player.id && e.type === 'farm').map(e => [e.id, e.amount]));
    const oldQueues = new Map<QueueItem, number>();
    for (const e of Object.values(s.entities)) if (e.owner === player.id) for (const q of e.queue) oldQueues.set(q, q.remaining);
    step(s);
    const tickSpent = empty(), tickGathered = empty(), tickReplant = empty();
    const logPurchase = (e: Entity, kind: string, type: string, cost: Partial<Resources>, totalSeconds?: number) => {
      add(tickSpent, cost); add(spent, cost);
      purchases.push({ tick: s.tick, seconds: s.tick / 20, building: e.id, kind, type, cost: { ...cost }, totalSeconds, stockAtEndTick: structuredClone(player.resources) });
    };
    for (const e of Object.values(s.entities)) {
      if (e.owner !== player.id) continue;
      if (!knownEntities.has(e.id)) {
        if (e.kind === 'building') {
          logPurchase(e, 'build', e.type, BUILDINGS[e.type as BuildingType].cost, BUILDINGS[e.type as BuildingType].seconds);
          first[`${e.type}Placed`] ??= s.tick / 20;
        } else if (e.kind === 'unit') {
          first[`${e.type}Produced`] ??= s.tick / 20;
          const queuedTick = unitOrigins.get(e.type)?.shift();
          if (queuedTick !== undefined && (s.tick - queuedTick + 1) / 20 < UNITS[e.type as keyof typeof UNITS].seconds - 1e-6) {
            anomalies.push({ tick: s.tick, issue: 'unit completed before its catalog timer', type: e.type, queuedTick });
          }
        }
      }
      if (e.kind === 'building' && e.progress === 1) first[`${e.type}Complete`] ??= s.tick / 20;
      for (const q of e.queue) {
        if (!knownQueues.has(q)) {
          knownQueues.add(q);
          logPurchase(e, q.kind === 'unit' ? 'recruit' : 'research', q.unit ?? q.kind, q.cost, q.total);
          if (q.kind === 'unit') unitOrigins.set(q.unit!, [...(unitOrigins.get(q.unit!) ?? []), s.tick]);
        }
        const prior = oldQueues.get(q);
        if (prior !== undefined && prior - q.remaining > .050000001) anomalies.push({ tick: s.tick, issue: 'queue advanced faster than 50 ms', building: e.id });
        if (q.remaining > q.total || !Number.isFinite(q.remaining)) anomalies.push({ tick: s.tick, issue: 'invalid queue timer', building: e.id });
      }
      if (e.type === 'farm' && (beforeFarms.get(e.id) ?? 1) <= 0 && e.amount > 0) {
        tickReplant.wood += 35; replants.wood += 35;
      }
      const carry = beforeCarries.get(e.id);
      if (carry && !e.carry) {
        tickGathered[carry.resource] += carry.amount;
        gathered[carry.resource] += carry.amount;
      }
    }
    for (const id of Object.keys(s.entities)) knownEntities.add(Number(id));
    const tickResidual = empty();
    for (const r of resources) {
      tickResidual[r] = player.resources[r] - beforeStock[r] + tickSpent[r] + tickReplant[r] - tickGathered[r];
      residual[r] += tickResidual[r];
    }
    // Opening runs normally have no trades or combat repairs. Preserve any unmatched
    // stock movement as an explicit anomaly rather than inventing an accepted command.
    if (resources.some(r => Math.abs(tickResidual[r]) > 1e-6)) anomalies.push({ tick: s.tick, issue: 'stock delta not explained by observed accepted purchases/dropoffs/replants', residual: rounded(tickResidual) });
    minimumStock = Math.min(minimumStock, ...Object.values(player.resources));
    if (s.tick % 600 === 0) snapshots.push({ seconds: s.tick / 20, stock: rounded(player.resources), catalogPurchases: rounded(spent), observedDropoffs: rounded(gathered), units: Object.values(s.entities).filter(e => e.owner === player.id && e.kind === 'unit').length, soldiers: Object.values(s.entities).filter(e => e.owner === player.id && e.kind === 'unit' && !['villager', 'scout'].includes(e.type)).length });
  }
  const wallMilliseconds = Math.round(performance.now() - started);
  const balance = empty(); add(balance, start); add(balance, gathered); add(balance, spent, -1); add(balance, replants, -1);
  const report = { difficulty, seed, simulatedSeconds: s.tick / 20, wallMilliseconds, player: player.id, sourceHashes, startStock: start, first, endStock: rounded(player.resources), acceptedCatalogPurchases: rounded(spent), observedDropoffs: rounded(gathered), replantCosts: rounded(replants), accountedEndStock: rounded(balance), unexplainedStockDelta: rounded(residual), minimumStock, anomalies, snapshots, purchases };
  reports.push(report);
  writeFileSync(`test-results/ai-opening-${difficulty}-${seed}.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ difficulty, seed, simulatedSeconds: report.simulatedSeconds, wallMilliseconds, first, endStock: report.endStock, catalogPurchases: report.acceptedCatalogPurchases, unexplainedStockDelta: report.unexplainedStockDelta, anomalies: anomalies.length }));
}
writeFileSync(`test-results/ai-opening-summary-${seed}.json`, `${JSON.stringify(reports.map(({ purchases, ...report }) => ({ ...report, purchaseCount: purchases.length })), null, 2)}\n`, 'utf8');
if (reports.some(r => r.minimumStock < -1e-6 || r.anomalies.length)) process.exitCode = 1;
