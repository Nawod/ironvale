import {it,expect} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {step,command} from '../src/sim/engine';
import {attackDamage,updateConquest} from '../src/sim/combat';
import {allied,hostile} from '../src/sim/teams';
import {updateVisibility,population,snapshot} from '../src/sim/visibility';
import {updateAI} from '../src/sim/ai';
import {distance} from '../src/sim/types';
import type {GameState} from '../src/sim/types';
const game=()=>createGame({opponents:1,difficulty:'normal',seed:42,zombies:true});
const undead=(s:GameState)=>Object.values(s.entities).filter(e=>e.type==='zombie');
const night=12000, dawn=26400;
function arena(){const s=game();s.entities={};s.tick=night;s.zombieNight=0;const a=spawn(s,'building','capital',0,{x:20,y:20}),b=spawn(s,'building','capital',1,{x:70,y:70});s.players[0].capital=a.id;s.players[1].capital=b.id;return{s,a,b};}
it('spawns forest hordes for human and AI cities once per night without player costs or vision',()=>{
 const s=game(),resources=structuredClone(s.players.map(p=>p.resources)),pops=s.players.map(p=>population(s,p.id));s.tick=night-1;step(s,1,false);
 expect(undead(s)).toHaveLength(16);
 for(const p of s.players){const cap=s.entities[p.capital],group=undead(s).filter(z=>distance(z,cap)<distance(z,s.entities[s.players[1-p.id].capital]));expect(group).toHaveLength(8);}
 for(const z of undead(s)){expect(z.owner).toBe(-2);expect(z.home).toBeDefined();expect(s.players.every(p=>distance(z,s.entities[p.capital])>=16)).toBe(true);expect(Object.values(s.entities).filter(e=>e.type==='wood'&&distance(e,z)<8).length).toBeGreaterThanOrEqual(3);}
 expect(s.players.map(p=>p.resources)).toEqual(resources);expect(s.players.map(p=>population(s,p.id))).toEqual(pops);
 const ids=undead(s).map(z=>z.id);delete s.entities[ids[0]];step(s,40,false);expect(undead(s)).toHaveLength(15);expect(s.zombieNight).toBe(0);
});
it('damages every player regardless of controllers or alliances and records building damage',()=>{
 const {s,a,b}=arena();s.players.forEach(p=>p.team=0);
 const z0=spawn(s,'unit','zombie',-2,{x:a.x-1,y:a.y}),z1=spawn(s,'unit','zombie',-2,{x:b.x-1,y:b.y});z0.home={x:8,y:8};z1.home={x:85,y:85};step(s,30,false);
 expect(a.hp).toBeLessThan(a.maxHp);expect(b.hp).toBeLessThan(b.maxHp);expect(a.lastDamagedTick).toBeGreaterThanOrEqual(night);expect(attackDamage(s,z0,a)).toBeGreaterThan(0);
 expect(hostile(s,-2,0)).toBe(true);expect(hostile(s,1,-2)).toBe(true);expect(hostile(s,-2,-1)).toBe(false);expect(hostile(s,-2,-2)).toBe(false);expect(allied(s,0,1)).toBe(true);
});
it('retreats at dawn without another hit, remains visible and idles in its home forest',()=>{
 const {s,a}=arena();s.tick=dawn-1;const z=spawn(s,'unit','zombie',-2,{x:19,y:20}),refuge=Object.freeze({x:12.5,y:20.5});z.home={...refuge};z.order={kind:'attack',target:a.id};const hp=a.hp,start=distance(z,refuge);step(s,1,false);expect(a.hp).toBe(hp);expect(s.entities[z.id]).toBeDefined();expect(z.order.kind).toBe('move');expect(z.order.point).toEqual(refuge);expect(z.home).toEqual(refuge);
 step(s,60,false);expect(distance(z,refuge)).toBeLessThan(start-2);expect(z.home).toEqual(refuge);
 step(s,120,false);expect(a.hp).toBe(hp);expect(distance(z,refuge)).toBeLessThan(.5);expect(z.x).toBeLessThan(13);expect(z.home).toEqual(refuge);expect(z.order.kind).toBe('idle');
});
it('preserves the original forest refuge through night target assignment and retargeting',()=>{
 const {s}=arena(),refuge=Object.freeze({x:12.5,y:35.5}),z=spawn(s,'unit','zombie',-2,{x:17.5,y:25.5});z.home={...refuge};step(s,30,false);expect(z.order.kind).toBe('attack');expect(z.home).toEqual(refuge);
 const defender=spawn(s,'unit','spearman',0,{x:z.x+1,y:z.y});step(s,20,false);expect(z.order.target).toBe(defender.id);expect(z.home).toEqual(refuge);
});
it('keeps the forest refuge when another fighter kills the zombie target during combat',()=>{
 const {s}=arena(),victim=spawn(s,'unit','spearman',0,{x:40,y:40}),fighter=spawn(s,'unit','spearman',1,{x:41,y:40}),z=spawn(s,'unit','zombie',-2,{x:40,y:41}),refuge=Object.freeze({x:30.5,y:40.5});victim.hp=1;fighter.order={kind:'attack',target:victim.id};z.order={kind:'attack',target:victim.id};z.home={...refuge};updateVisibility(s);step(s,1,false);expect(s.entities[victim.id]).toBeUndefined();expect(z.home).toEqual(refuge);
});
it('lets player troops target neutral zombies without hitting wildlife',()=>{
 const {s}=arena(),u=spawn(s,'unit','spearman',0,{x:40,y:40}),z=spawn(s,'unit','zombie',-2,{x:41,y:40});z.home={x:50,y:40};const animal=spawn(s,'resource','deer',-1,{x:40,y:41});updateVisibility(s);expect(command(s,{type:'order',ids:[u.id],player:0,order:{kind:'attack',target:z.id}})).toBeNull();step(s,2,false);expect(z.hp).toBeLessThan(z.maxHp);expect(animal.hp).toBe(animal.maxHp);expect(command(s,{type:'order',ids:[z.id],player:0,order:{kind:'move',point:{x:30,y:30}}})).toBeTruthy();
});
it('breaches a wall when the enclosed city is unreachable',()=>{
 const {s,a}=arena();for(let x=18;x<=24;x++)for(let y=18;y<=24;y++)if(x===18||y===18||x===24||y===24)spawn(s,'building','wall',0,{x,y});const z=spawn(s,'unit','zombie',-2,{x:16.5,y:20.5});z.home={x:8,y:20};step(s,100,false);expect(Object.values(s.entities).some(e=>e.type==='wall'&&e.hp<e.maxHp)).toBe(true);expect(a.hp).toBe(a.maxHp);
});
it('never captures a city and can contest player occupation',()=>{
 const {s,a}=arena();a.hp=0;const z=spawn(s,'unit','zombie',-2,{x:19,y:20});updateConquest(s,40);expect(a.occupation).toBeUndefined();expect(s.players[0].alive).toBe(true);spawn(s,'unit','spearman',1,{x:19,y:21});updateConquest(s,40);expect(a.occupation?.progress).toBe(0);delete s.entities[z.id];updateConquest(s,30);expect(s.players[0].alive).toBe(false);
});
it('leaves ordinary simulations and random streams identical when disabled',()=>{
 const a=createGame({opponents:1,difficulty:'normal',seed:21}),b=createGame({opponents:1,difficulty:'normal',seed:21,zombies:false});a.tick=b.tick=night-1;step(a,100,false);step(b,100,false);delete b.config.zombies;expect(b).toEqual(a);expect(undead(a)).toHaveLength(0);
});
it('resumes deterministic waves from saved state and bounds population across nights',()=>{
 const s=game();s.tick=night-1;step(s,1,false);const copy:GameState=JSON.parse(JSON.stringify(s));step(s,100,false);step(copy,100,false);expect(copy).toEqual(s);
 for(let day=1;day<9;day++){s.tick=night+day*28800-1;step(s,1,false);expect(undead(s).length).toBeLessThanOrEqual(24);expect(undead(s).length).toBeGreaterThanOrEqual(16);}
});
it('spawns no daytime wave and grants no map vision from remote zombies',()=>{
 const s=game();step(s,2,false);expect(undead(s)).toHaveLength(0);const before=structuredClone(s.visible),z=spawn(s,'unit','zombie',-2,{x:48,y:48});z.home={x:48,y:48};updateVisibility(s);expect(s.visible).toEqual(before);expect(snapshot(s,0).entities.some(e=>e.id===z.id)).toBe(false);
});
it('keeps an eight-city wave within the global bound and replenishes only at the following night',()=>{
 const s=createGame({opponents:7,difficulty:'normal',seed:42,zombies:true});s.tick=night-1;step(s,1,false);expect(undead(s)).toHaveLength(64);
 const homes=undead(s).map(z=>z.home!);for(const p of s.players)expect(homes.some(h=>distance(h,s.entities[p.capital])<32)).toBe(true);
 for(const z of undead(s).slice(0,8))delete s.entities[z.id];step(s,1,false);expect(undead(s)).toHaveLength(56);
 s.tick=night+28800*10-1;step(s,1,false);expect(undead(s).length).toBeLessThanOrEqual(96);expect(undead(s).length).toBeGreaterThan(56);
});
it('does not invent forest spawns on a map without wood clusters',()=>{
 const s=game();for(const e of Object.values(s.entities))if(e.type==='wood')delete s.entities[e.id];s.tick=night-1;step(s,1,false);expect(undead(s)).toHaveLength(0);expect(s.zombieNight).toBe(0);
});
it('makes the AI defend against visible zombies',()=>{
 const {s,b}=arena(),guard=spawn(s,'unit','spearman',1,{x:b.x-3,y:b.y}),z=spawn(s,'unit','zombie',-2,{x:b.x-6,y:b.y});z.home={x:80,y:80};s.players[1].ai.nextThink=0;updateVisibility(s);updateAI(s);expect(guard.order.kind).toBe('attackMove');expect(guard.order.point).toEqual({x:z.x,y:z.y});
});
