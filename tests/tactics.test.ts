import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {attackDamage,updateCombat} from '../src/sim/combat';
import {navigationGrids} from '../src/sim/navigation';
import {updateVisibility} from '../src/sim/visibility';
import {step} from '../src/sim/engine';
import {encodeSave,decodeSave} from '../src/sim/save';
import {TERRAIN} from '../src/sim/terrain';
import {attackRange,clearAttackLine} from '../src/sim/combat-tactics';
import type {GameState,UnitType} from '../src/sim/types';

function arena(elevated=false,size=32){
 const s=createGame({opponents:1,difficulty:'normal',seed:42});s.size=size;s.entities={};s.terrain=Array(size*size).fill(0);
 s.explored=s.players.map(()=>Array(size*size).fill(0));s.visible=s.players.map(()=>Array(size*size).fill(0));s.intel=s.players.map(()=>({}));
 if(elevated)s.elevation=Array((size+1)**2).fill(0);else delete s.elevation;
 return s;
}
function fighter(s:GameState,type:UnitType,owner:number,x:number,y=12.5){const e=spawn(s,'unit',type,owner,{x,y});e.stance='hold';return e;}
function combat(s:GameState,dt=.05){updateVisibility(s);updateCombat(s,dt,navigationGrids(s));}
function ridge(s:GameState,height=6){for(let y=10;y<=14;y++){s.terrain[y*s.size+13]=TERRAIN.mountain;for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++)s.elevation![(y+dy)*(s.size+1)+13+dx]=height;}}

it('extends downhill archer fire beyond flat range without changing damage',()=>{
 const s=arena(true),a=fighter(s,'archer',0,9.5),b=fighter(s,'spearman',1,16.5);b.cooldown=100;
 for(let y=0;y<=32;y++)for(let x=0;x<=11;x++)s.elevation![y*33+x]=8;
 combat(s);expect(b.hp).toBe(84.5);expect(a.x).toBe(9.5);
});
it('blocks an arrow through a visible solid mountain and spends no cooldown',()=>{
 const s=arena(true),a=fighter(s,'archer',0,10.5),b=fighter(s,'spearman',1,16.5);b.cooldown=100;ridge(s);
 combat(s);expect(b.hp).toBe(100);expect(a.cooldown).toBe(0);expect(a.attackFx).toBeUndefined();
});
it('blocks a shot grazing the high corner of a mountain tile',()=>{
 const s=arena(true),a=fighter(s,'archer',0,10.1,13.09),b=fighter(s,'spearman',1,14.1,17.09);b.cooldown=100;
 s.terrain[15*32+13]=TERRAIN.mountain;for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++)s.elevation![(15+dy)*33+13+dx]=8;
 combat(s);expect(b.hp).toBe(100);expect(clearAttackLine(s,a,b)).toBe(false);
});
it('moves an ordered archer around a ridge and eventually lands a hit',()=>{
 const s=arena(true),a=fighter(s,'archer',0,10.5),b=fighter(s,'spearman',1,16.5);b.cooldown=100;a.stance='aggressive';a.order={kind:'attack',target:b.id};ridge(s);
 combat(s);expect(a.x!==10.5||a.y!==12.5).toBe(true);expect(b.hp).toBe(100);
 for(let i=0;i<180&&b.hp===100;i++){s.tick++;combat(s);}expect(b.hp).toBeLessThan(100);expect(a.order.target).toBe(b.id);
});
it.each([['spearman','cavalry','swordsman'],['pikeman','scout','swordsman'],['cavalry','archer','swordsman'],['heavyCavalry','crossbowman','swordsman'],['archer','spearman','swordsman']] as [UnitType,UnitType,UnitType][])(
 '%s acquires its nearby %s counter target instead of a slightly closer %s', (type,preferred,other)=>{
 const s=arena(),a=fighter(s,type,0,10.5),near=fighter(s,other,1,11),counter=fighter(s,preferred,1,11.5);near.cooldown=counter.cooldown=100;
 combat(s);expect(counter.hp).toBeLessThan(counter.maxHp);expect(near.hp).toBe(near.maxHp);expect(a.attackFx?.x).toBe(counter.x);
});
it('does not counter-prefer a hidden, allied, out-of-range or garrisoned unit',()=>{
 const s=arena(),a=fighter(s,'spearman',0,10.5),enemy=fighter(s,'swordsman',1,11.5),friendly=fighter(s,'cavalry',0,10.75),hidden=fighter(s,'cavalry',1,10.5,13),far=fighter(s,'cavalry',1,20),garrisoned=fighter(s,'cavalry',1,11);
 garrisoned.garrisoned=999;for(const e of [enemy,friendly,hidden,far,garrisoned])e.cooldown=100;updateVisibility(s);s.visible[0][13*32+10]=0;updateCombat(s,.05,navigationGrids(s));
 expect(enemy.hp).toBeLessThan(enemy.maxHp);for(const e of [friendly,hidden,far,garrisoned])expect(e.hp).toBe(e.maxHp);expect(a.attackFx?.x).toBe(enemy.x);
});
it('preserves explicit capital attacks despite preferred mounted targets',()=>{
 const s=arena(),a=fighter(s,'spearman',0,10.5),cap=spawn(s,'building','capital',1,{x:11.5,y:11.5}),horse=fighter(s,'cavalry',1,11);horse.cooldown=100;cap.cooldown=100;a.order={kind:'attack',target:cap.id};
 combat(s);expect(cap.hp).toBeLessThan(cap.maxHp);expect(horse.hp).toBe(horse.maxHp);expect(a.order.target).toBe(cap.id);
});
it('keeps flat legacy range and counter damage with no elevation state',()=>{
 const s=arena(),a=fighter(s,'archer',0,9.5),b=fighter(s,'spearman',1,16.5),horse=fighter(s,'cavalry',1,20),z=fighter(s,'zombie',-2,22);
 combat(s);expect(b.hp).toBe(100);expect(attackDamage(s,b,horse)).toBeCloseTo(27.8);expect(attackDamage(s,b,z)).toBe(10);expect(attackDamage(s,z,horse)).toBe(8);expect(s.elevation).toBeUndefined();
});
it('bounds the downhill bonus, gives no uphill bonus and leaves melee reach unchanged',()=>{
 const s=arena(true),a=fighter(s,'archer',0,9.5),b=fighter(s,'spearman',1,17),c=fighter(s,'spearman',0,9.5,10.5);
 for(let y=0;y<=32;y++)for(let x=0;x<=11;x++)s.elevation![y*33+x]=12;
 const range=attackRange(s,a,b);expect(range.base).toBe(6);expect(range.bonus).toBeCloseTo(1.2);expect(range.max).toBe(7.2);expect(range.heightAdvantage).toBe(12);
 expect(attackRange(s,b,a).max).toBe(1.6);expect(attackRange(s,c,b).max).toBe(1.6);
 combat(s);expect(b.hp).toBe(100);expect(attackRange(s,a).max).toBe(7.2);
});
it('lets a trebuchet arc over a low ridge but intercepts it at a higher ridge',()=>{
 const s=arena(true),a=fighter(s,'trebuchet',0,10.5),b=fighter(s,'spearman',1,16.5);b.cooldown=100;ridge(s,3);
 expect(clearAttackLine(s,a,b)).toBe(true);combat(s);expect(b.hp).toBe(87);
 a.cooldown=0;ridge(s,10);combat(s);expect(b.hp).toBe(87);expect(a.cooldown).toBe(0);
});
it('does not make forests, resource trees or buildings intercept arrows',()=>{
 const s=arena(true),a=fighter(s,'archer',0,10.5),b=fighter(s,'spearman',1,16.5);b.cooldown=100;
 for(let y=10;y<=14;y++)s.terrain[y*32+13]=TERRAIN.woodland;
 const wall=spawn(s,'building','wall',0,{x:13,y:12}),tree=spawn(s,'resource','wood',-1,{x:14,y:12});
 combat(s);expect(b.hp).toBe(84.5);expect(wall.hp).toBe(wall.maxHp);expect(tree.hp).toBe(tree.maxHp);expect(a.attackFx?.x).toBe(16.5);
});
it('keeps legacy mountain codes transparent when elevation data is absent',()=>{
 const s=arena(),a=fighter(s,'archer',0,10.5),b=fighter(s,'spearman',1,16.5);b.cooldown=100;s.terrain[12*32+13]=TERRAIN.mountain;
 combat(s);expect(b.hp).toBe(84.5);expect(attackRange(s,a).max).toBe(6);
});
it('retains defensive home limits while acquiring preferred counter targets',()=>{
 const s=arena(),a=fighter(s,'spearman',0,10.5),horse=fighter(s,'cavalry',1,11.5),foot=fighter(s,'swordsman',1,10);
 a.stance='defensive';a.home={x:3.5,y:12.5};horse.cooldown=foot.cooldown=100;
 combat(s);expect(horse.hp).toBe(200);expect(foot.hp).toBe(138);expect(a.attackFx?.x).toBe(10);
});
it('keeps elevated combat deterministic across save reload and replay',()=>{
 const s=arena(true,160),a=fighter(s,'archer',0,10.5),b=fighter(s,'spearman',1,16.5);b.cooldown=100;a.stance='aggressive';a.order={kind:'attack',target:b.id};ridge(s);
 for(const p of s.players)p.capital=spawn(s,'building','capital',p.id,{x:30+p.id*20,y:30}).id;
 const copy=decodeSave(encodeSave(s));step(s,120,false);step(copy,120,false);expect(copy).toEqual(s);expect(b.hp).toBeLessThan(100);
});
