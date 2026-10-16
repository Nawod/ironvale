export type Resource = 'food' | 'wood' | 'stone' | 'gold';
export type Resources = Record<Resource, number>;
export type AnimalType = 'deer' | 'cow' | 'alpaca' | 'fox';
export type FoodSourceType = AnimalType | 'berries';
export type UnitType = 'villager' | 'scout' | 'spearman' | 'swordsman' | 'archer' | 'cavalry' | 'ram' | 'trebuchet' | 'pikeman' | 'crossbowman' | 'heavyCavalry' | 'zombie';
export type BuildingType = 'capital' | 'outpost' | 'house' | 'storage' | 'farm' | 'barracks' | 'palisade' | 'range' | 'stable' | 'smithy' | 'market' | 'wall' | 'gate' | 'tower' | 'fortress' | 'workshop';
export type Position = { x: number; y: number };
export type Formation = 'line' | 'box' | 'spread';
export type Order = { kind: 'idle' | 'move' | 'gather' | 'build' | 'repair' | 'attack' | 'attackMove' | 'patrol' | 'garrison'; target?: number; point?: Position; origin?: Position; returning?: boolean };
export type QueueItem = { kind: 'unit' | 'age' | 'weapons' | 'armor' | 'wall'; unit?: UnitType; remaining: number; total: number; cost: Partial<Resources> };
export interface WorkerTask { order: Order; buildQueue?: number[]; lastKnown?: Position }
export interface Entity extends Position {
  id: number; kind: 'unit' | 'building' | 'resource'; type: UnitType | BuildingType | Resource | FoodSourceType; owner: number;
  hp: number; maxHp: number; order: Order; path: Position[]; pathGoal?: Position; cooldown: number;
  progress: number; queue: QueueItem[]; amount: number; carry?: { resource: Resource; amount: number }; nextPathTick?:number; attackFx?:Position & {tick:number};
  stance: 'aggressive' | 'defensive' | 'hold'; home?: Position; garrisoned?: number; garrison: number[];
  buildQueue?: number[];
  taskQueue?: WorkerTask[];
  formation?: Formation;
  rally?: { point: Position; target?: number };
  wallTier?: 3;
  visualAge?: 1 | 2 | 3;
  lastDamagedTick?: number;
  occupation?: { owner: number; progress: number }; ghost?: boolean;
}
export type Difficulty = 'easy' | 'normal' | 'hard';
export type MatchMode = 'ffa' | 'teams';
export type MapType = 'lowlands' | 'riverlands';
export interface MatchConfig { opponents: 1 | 2 | 3 | 4 | 5 | 6 | 7; participants?: {name:string;controller:'human'|'ai';team?:number}[]; difficulty: Difficulty; seed: number; tutorial?: boolean; zombies?: boolean; mapType?: MapType }
export interface AIState { nextThink: number; rally?: Position; target?: number; raids: number }
export interface Player { controller:'human'|'ai'; id: number; team?:number; name: string; color: string; alive: boolean; age: 1 | 2 | 3; resources: Resources; capital: number; weapons: number; armor: number; ai: AIState }
export interface GameEvent { id: number; tick: number; kind: 'info' | 'attack' | 'capture' | 'error' | 'complete'; player: number; text: string; x?: number; y?: number }
export interface GameState { version: 2; config: MatchConfig; tick: number; zombieNight?: number; rng: number; nextId: number; nextEvent: number; size: number; terrain: number[]; entities: Record<number, Entity>; players: Player[]; explored: number[][]; visible: number[][]; intel: Record<number, Entity>[]; events: GameEvent[]; winner: number | null; paused: boolean }
export interface Snapshot { playerId:number; tick: number; size: number; terrain: number[]; entities: Entity[]; players: Player[]; fog: number[]; events: GameEvent[]; winner: number | null; paused: boolean; config: MatchConfig; population: number; capacity: number }
export type Command =
 | { type: 'order'; ids: number[]; order: Order; player: number }
 | { type: 'formation'; ids: number[]; formation: Formation; player: number }
 | { type: 'rally'; building: number; point: Position; target?: number; player: number }
 | { type: 'clearRally'; building: number; player: number }
 | { type: 'build'; building: BuildingType; point: Position; workers: number[]; player: number }
 | { type: 'buildWallLine'; building: 'palisade' | 'wall'; start: Position; end: Position; workers: number[]; player: number }
 | { type: 'recruit'; building: number; unit: UnitType; player: number; count?: number }
 | { type: 'upgradeWall'; building: number; player: number }
 | { type: 'moveBuilding'; building: number; point: Position; player: number }
 | { type: 'removeBuilding'; building: number; player: number }
 | { type: 'research'; building: number; research: 'age' | 'weapons' | 'armor'; player: number }
 | { type: 'trade'; sell: Resource; buy: Resource; player: number }
 | { type: 'stance'; ids: number[]; stance: Entity['stance']; player: number }
 | { type: 'ungarrison'; building: number; player: number }
 | { type: 'rebuild'; workers: number[]; player: number };
export const emptyResources = (): Resources => ({ food: 0, wood: 0, stone: 0, gold: 0 });
export const isUnit = (e: Entity): boolean => e.kind === 'unit';
export const military = (e: Entity): boolean => e.kind === 'unit' && e.type !== 'villager';
export const distance = (a: Position, b: Position): number => Math.hypot(a.x - b.x, a.y - b.y);
