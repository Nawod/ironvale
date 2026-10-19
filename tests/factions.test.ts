import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {command,step} from '../src/sim/engine';
import {decodeSave,encodeSave} from '../src/sim/save';
import {updateConquest,attackDamage,updateCombat} from '../src/sim/combat';
import {population,snapshot,updateVisibility} from '../src/sim/visibility';
import {navigationGrids,travel} from '../src/sim/navigation';
import {TERRAIN} from '../src/sim/terrain';
import {updateAI} from '../src/sim/ai';
import {UNITS} from '../src/sim/definitions';
import * as factions from '../src/sim/factions';
import type {FactionId} from '../src/sim/types';
const game=(faction?:FactionId)=>createGame({opponents:1,difficulty:'normal',seed:42,faction});
const rich=(s:ReturnType<typeof game>)=>{s.players[0].age=3;s.players[0].resources={food:10000,wood:10000,stone:10000,gold:10000};spawn(s,'building','house',0,{x:28,y:20});};
it('rejects explicit invalid factions while retaining neutral legacy saves',()=>{
 expect(()=>createGame({...game().config,faction:'fake'} as any)).toThrow(/faction/i);
 const s=game();expect(decodeSave(encodeSave(s)).players[0].faction).toBeUndefined();
 const bad=JSON.parse(encodeSave(s));bad.players[0].faction='fake';expect(()=>decodeSave(JSON.stringify(bad))).toThrow(/faction/i);
});
it('persists distinct participant factions and rejects inconsistent saves',()=>{
 const s=createGame({opponents:1,difficulty:'normal',seed:42,participants:[{name:'A',controller:'human',faction:'kandy'},{name:'B',controller:'ai',faction:'ravana'}]});
 expect(s.players.map(p=>p.faction)).toEqual(['kandy','ravana']);expect(encodeSave(decodeSave(encodeSave(s)))).toBe(encodeSave(s));
 s.players[0].faction='british';expect(()=>decodeSave(encodeSave(s))).toThrow(/faction/i);
});
it('gates special troops by faction, age and owned production building',()=>{
 const s=game('anuradhapura');rich(s);const stable=spawn(s,'building','stable',0,{x:30,y:30});
 const recruit=(unit:any,building=stable.id)=>command(s,{type:'recruit',player:0,building,unit});
 expect(recruit('rifleman')).toBeTruthy();expect(recruit('warElephant',s.players[1].capital)).toBeTruthy();s.players[0].age=1;expect(recruit('warElephant')).toBeTruthy();s.players[0].age=3;expect(recruit('warElephant')).toBeNull();
 expect(factions.factionUnitTypes(undefined,'stable')).not.toContain('warElephant');expect(factions.unitName('champion',s.players[0])).toContain('Yodha');
});
it('charges faction costs, reserves weighted population and trains through normal timers',()=>{
 const s=game('ravana');rich(s);const workshop=spawn(s,'building','workshop',0,{x:30,y:30}),d=factions.unitStats('danduMonara',s.players[0]),before={...s.players[0].resources};
 expect(command(s,{type:'recruit',player:0,building:workshop.id,unit:'danduMonara'})).toBeNull();
 for(const [r,n]of Object.entries(d.cost))expect(s.players[0].resources[r as keyof typeof before]).toBe(before[r as keyof typeof before]-n!);
 expect(workshop.queue[0].total).toBe(d.seconds);expect(command(s,{type:'recruit',player:0,building:workshop.id,unit:'danduMonara',count:5})).toContain('population');
 step(s,Math.floor(d.seconds*20)-1,false);expect(Object.values(s.entities).some(e=>e.type==='danduMonara')).toBe(false);step(s,3,false);expect(population(s,0)).toBe(7+factions.populationCost('danduMonara'));
});
it('flies across blocked terrain and remains targetable only by ranged weapons',()=>{
 const s=game('ravana'),air=spawn(s,'unit','danduMonara',0,{x:40.5,y:40.5}),spear=spawn(s,'unit','pikeman',1,{x:42,y:40.5}),bow=spawn(s,'unit','archer',1,{x:43,y:40.5});
 s.terrain[40*s.size+41]=TERRAIN.mountain;const grids=navigationGrids(s);for(let i=0;i<30;i++)travel(s,air,{x:42.5,y:40.5},.05,grids[0]);expect(air.x).toBeGreaterThan(41.5);
 expect(factions.canAttack(spear,air)).toBe(false);expect(factions.canAttack(bow,air)).toBe(true);updateVisibility(s);const hp=air.hp;updateCombat(s,.05,grids);expect(air.hp).toBeLessThan(hp);
 expect(command(s,{type:'order',player:0,ids:[air.id],order:{kind:'garrison',target:spawn(s,'building','fortress',0,{x:50,y:50}).id}})).toBeTruthy();
});
it('prevents airborne occupation, then captures assets with conqueror stats without stacking',()=>{
 const s=game('portuguese'),cap=s.entities[s.players[1].capital];for(const e of Object.values(s.entities))if(e.kind==='unit'){e.x=90;e.y=90;}
 cap.hp=0;const air=spawn(s,'unit','danduMonara',0,{x:cap.x-1,y:cap.y});updateConquest(s,31);expect(s.players[1].alive).toBe(true);delete s.entities[air.id];
 const fort=spawn(s,'building','fortress',1,{x:30,y:30});fort.hp=fort.maxHp/2;spawn(s,'unit','spearman',0,{x:cap.x-1,y:cap.y});updateConquest(s,31);
 expect(fort.owner).toBe(0);expect(fort.maxHp).toBe(factions.buildingStats('fortress',s.players[0]).hp);expect(fort.hp).toBe(fort.maxHp/2);
});
it('keeps team protection, private resources, zombie targeting and neutral balance',()=>{
 const s=createGame({opponents:2,difficulty:'normal',seed:42,zombies:true,participants:[{name:'A',controller:'human',team:0,faction:'british'},{name:'B',controller:'human',team:0,faction:'kandy'},{name:'C',controller:'ai',team:1,faction:'ravana'}]});
 const a=spawn(s,'unit','rifleman',0,{x:50,y:50}),b=spawn(s,'unit','warElephant',1,{x:51,y:50}),z=spawn(s,'unit','zombie',-2,{x:52,y:50});updateVisibility(s);
 expect(command(s,{type:'order',player:0,ids:[a.id],order:{kind:'attack',target:b.id}})).toContain('enemy');expect(command(s,{type:'order',player:0,ids:[a.id],order:{kind:'attack',target:z.id}})).toBeNull();expect(snapshot(s,0).players[1].resources.gold).toBe(0);
 expect(factions.unitStats('spearman')).toEqual(UNITS.spearman);expect(attackDamage(s,a,z)).toBeGreaterThan(0);
});

it('applies advertised farm and stone-construction specialties through the command economy',()=>{
 const s=game('polonnaruwa');rich(s);s.visible[0].fill(1);s.terrain.fill(0);s.elevation!.fill(0);for(const e of Object.values(s.entities))if(e.kind==='resource')delete s.entities[e.id];
 const worker=Object.values(s.entities).find(e=>e.owner===0&&e.type==='villager')!,cost=s.players[0].resources.wood;
 expect(command(s,{type:'build',player:0,building:'farm',point:{x:40,y:40},workers:[worker.id]})).toBeNull();
 expect(s.players[0].resources.wood).toBe(cost-36);const farm=s.entities[s.nextId-1];expect(farm.maxHp).toBe(factions.buildingStats('farm',s.players[0]).hp);
 expect(command(s,{type:'build',player:0,building:'tower',point:{x:45,y:45},workers:[worker.id]})).toBeNull();const tower=s.entities[s.nextId-1];worker.x=44.5;worker.y=45.5;
 step(s,20,false);expect(tower.progress).toBeCloseTo(1/factions.buildingStats('tower',s.players[0]).seconds,4);
});
it('makes pikes counter elephants and ranged fire counter the flying craft in real combat',()=>{
 const s=game('ravana');const air=spawn(s,'unit','danduMonara',0,{x:40,y:40}),pike=spawn(s,'unit','pikeman',1,{x:40.5,y:40}),elephant=spawn(s,'unit','warElephant',0,{x:41,y:41});
 expect(attackDamage(s,pike,air)).toBe(0);expect(attackDamage(s,pike,elephant)).toBeGreaterThan(35);
 pike.order={kind:'attack',target:air.id};elephant.x=70;elephant.y=70;air.stance='hold';air.cooldown=100;updateVisibility(s);const hp=air.hp;updateCombat(s,1,navigationGrids(s));expect(air.hp).toBe(hp);
});
it('roundtrips aircraft over water with deterministic flight and paid queues',()=>{
 const s=game('ravana');rich(s);const air=spawn(s,'unit','danduMonara',0,{x:40.5,y:40.5});s.terrain[40*s.size+40]=TERRAIN.water;
 air.order={kind:'move',point:{x:44,y:40}};const workshop=spawn(s,'building','workshop',0,{x:30,y:30});expect(command(s,{type:'recruit',player:0,building:workshop.id,unit:'danduMonara'})).toBeNull();
 const restored=decodeSave(encodeSave(s));step(s,40,false);step(restored,40,false);expect(encodeSave(restored)).toBe(encodeSave(s));
});

it('allows multiple flying units to receive destinations across a water barrier',()=>{
 const s=game('ravana');s.terrain.fill(0);s.elevation!.fill(0);for(let y=0;y<s.size;y++)s.terrain[y*s.size+45]=TERRAIN.water;
 const units=[spawn(s,'unit','danduMonara',0,{x:40,y:40}),spawn(s,'unit','danduMonara',0,{x:40,y:42})];
 expect(command(s,{type:'order',player:0,ids:units.map(e=>e.id),order:{kind:'move',point:{x:50,y:40}}})).toBeNull();expect(units.every(e=>e.order.point!.x>45)).toBe(true);
});
it('does not let aircraft distract zombies from attackable ground targets',()=>{
 const s=createGame({opponents:1,difficulty:'normal',seed:42,zombies:true,faction:'ravana'});s.terrain.fill(0);s.elevation!.fill(0);s.tick=12000;s.zombieNight=0;
 const air=spawn(s,'unit','danduMonara',0,{x:40,y:40}),ground=spawn(s,'unit','spearman',0,{x:43,y:40}),z=spawn(s,'unit','zombie',-2,{x:40.5,y:40});air.cooldown=100;ground.cooldown=100;air.stance=ground.stance='hold';z.home={x:30,y:40};
 step(s,1,false);expect(z.order.target).toBe(ground.id);
});

it('keeps every special unit on the declared faction roster and charges its full unlocked cost',()=>{
 const expected:Record<FactionId,string[]>={anuradhapura:['warElephant','champion'],polonnaruwa:['warElephant'],kandy:['warElephant','musketeer'],chola:['warElephant'],elara:['warElephant'],jaffna:['warElephant'],portuguese:['musketeer','cannon'],dutch:['musketeer','cannon'],british:['musketeer','rifleman','cannon'],ravana:['warElephant','champion','danduMonara']};
 const buildings=['barracks','range','stable','workshop'] as const,specials=['warElephant','champion','musketeer','rifleman','cannon','danduMonara'];
 for(const id of Object.keys(expected) as FactionId[]){
  const s=game(id);rich(s);for(let i=0;i<4;i++)spawn(s,'building','house',0,{x:30+i*3,y:25});
  const available=buildings.flatMap(b=>factions.factionUnitTypes(s.players[0],b)).filter(u=>specials.includes(u));expect(available.sort()).toEqual(expected[id].sort());
  for(const building of buildings){const b=spawn(s,'building',building,0,{x:35,y:35});for(const type of factions.factionUnitTypes(s.players[0],building).filter(u=>specials.includes(u))){const before={...s.players[0].resources},def=factions.unitStats(type,s.players[0]);expect(command(s,{type:'recruit',player:0,building:b.id,unit:type})).toBeNull();expect(b.queue.at(-1)).toMatchObject({unit:type,total:def.seconds,remaining:def.seconds,cost:def.cost});for(const [r,n]of Object.entries(def.cost))expect(s.players[0].resources[r as keyof typeof before]).toBe(before[r as keyof typeof before]-n!);}}
 }
});

it('makes AI choose unlocked faction troops and pay the same authoritative costs',()=>{
 const s=game('british');rich(s);s.players[0].controller='ai';s.players[1].controller='human';for(const e of Object.values(s.entities))if(e.type==='villager')delete s.entities[e.id];s.players[0].resources={food:100000,wood:100000,stone:100000,gold:100000};
 const workshop=spawn(s,'building','workshop',0,{x:30,y:30}),range=spawn(s,'building','range',0,{x:35,y:30}),chosen=new Set<string>();
 for(let turn=0;turn<24;turn++){
  workshop.queue=[];range.queue=[];s.players[0].ai.nextThink=s.tick;const before={...s.players[0].resources},existing=new Set(Object.values(s.entities).flatMap(e=>e.queue));updateAI(s);
  const queued=Object.values(s.entities).flatMap(e=>e.queue).filter(q=>!existing.has(q));
  for(const q of queued){if(q.unit)chosen.add(q.unit);expect(q.unit&&factions.factionUnitTypes(s.players[0],Object.values(s.entities).find(e=>e.queue.includes(q))!.type as any).includes(q.unit)).toBe(true);}
  for(const resource of ['food','wood','stone','gold'] as const)expect(s.players[0].resources[resource]).toBe(before[resource]-queued.reduce((n,q)=>n+(q.cost[resource]??0),0));s.tick+=50;
 }
 expect(chosen.has('rifleman')).toBe(true);expect(chosen.has('cannon')).toBe(true);expect(chosen.has('danduMonara')).toBe(false);
});
