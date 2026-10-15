import {expect,it} from 'vitest';
import {createGame,spawn} from '../src/sim/world';
import {step} from '../src/sim/engine';
import {updateVisibility} from '../src/sim/visibility';
import {updateAI} from '../src/sim/ai';
import {distance} from '../src/sim/types';

function siege(){const s=createGame({opponents:1,difficulty:'normal',seed:42});for(const e of Object.values(s.entities))if(e.kind!=='building')delete s.entities[e.id];const target=s.entities[s.players[0].capital];target.x=40;target.y=40;const home=s.entities[s.players[1].capital];home.x=70;home.y=70;s.players.forEach(p=>p.resources={food:0,wood:0,stone:0,gold:0});s.players[1].ai.nextThink=0;const army=Array.from({length:8},(_,i)=>spawn(s,'unit','swordsman',1,{x:35+i%2,y:40+Math.floor(i/2)}));updateVisibility(s);return{s,target,home,army};}
it('commits the main force to a visible living capital instead of chasing a cheap nearby scout',()=>{const{s,target,army}=siege();spawn(s,'unit','scout',0,{x:34,y:40});updateVisibility(s);updateAI(s);expect(army.filter(e=>e.order.kind==='attack'&&e.order.target===target.id).length).toBeGreaterThanOrEqual(5);});
it('destroys a defended capital in sustained combat, then occupies for 30 seconds before capture',()=>{const{s,target}=siege();for(let i=0;i<2;i++){const w=spawn(s,'unit','villager',0,{x:43.5,y:41+i});w.order={kind:'repair',target:target.id};}s.players[0].resources.wood=100;spawn(s,'unit','scout',0,{x:34,y:40});updateVisibility(s);let fallenTick=-1;while(s.tick<4000&&target.hp>0)step(s,1);fallenTick=s.tick;expect(target.hp).toBe(0);expect(s.players[0].alive).toBe(true);expect(s.winner).toBeNull();expect(target.occupation?.progress??0).toBeLessThan(1);while(s.tick<fallenTick+598)step(s,1);expect(s.players[0].alive).toBe(true);step(s,100);expect(s.players[0].alive).toBe(false);expect(target.type).toBe('outpost');expect(target.owner).toBe(1);expect(s.players[1].resources).toEqual({food:0,wood:0,stone:0,gold:0});});
it('breaches an enclosing wooden wall and finishes the capital rather than stalling on an unreachable attack',()=>{const{s,target,army}=siege();for(const e of army){e.type='ram';e.hp=e.maxHp=350;}for(let x=38;x<=44;x++)for(let y=38;y<=44;y++)if(x===38||x===44||y===38||y===44)spawn(s,'building','palisade',0,{x,y});updateVisibility(s);step(s,3200);expect(s.players[0].alive).toBe(false);expect(target.owner).toBe(1);});
it('rechecks an established capital attack when a defender finishes an enclosing wall',()=>{
 const{s,target,army}=siege();for(const e of army){e.type='ram';e.hp=e.maxHp=350;}
 updateVisibility(s);updateAI(s);
 expect(army.every(e=>e.order.kind==='attack'&&e.order.target===target.id)).toBe(true);
 for(let x=38;x<=44;x++)for(let y=38;y<=44;y++)if(x===38||x===44||y===38||y===44)spawn(s,'building','palisade',0,{x,y});
 updateVisibility(s);step(s,3200);
 expect(s.players[0].alive).toBe(false);expect(target.owner).toBe(1);
});
it('does not issue hidden-capital attacks or abandon home defense to a siege',()=>{const{s,target,home,army}=siege();for(const e of army){e.x=home.x-5;e.y=home.y+4;}s.intel[1][target.id]={...structuredClone(target),ghost:true};target.hp=0;updateVisibility(s);spawn(s,'unit','spearman',0,{x:home.x-6,y:home.y+3});updateVisibility(s);updateAI(s);expect(army.every(e=>e.order.point&&distance(e.order.point,home)<18)).toBe(true);expect(army.some(e=>e.stance==='hold')).toBe(false);});
it('continues an established siege with surviving troops below the initial raid size',()=>{const{s,target,army}=siege();s.players[1].ai.target=target.id;s.intel[1][target.id]=structuredClone(target);for(const [i,e]of army.entries()){if(i>=4){delete s.entities[e.id];continue;}e.type='ram';e.hp=e.maxHp=350;e.x=22+i;e.y=42;}updateVisibility(s);step(s,2600);expect(target.owner).toBe(1);expect(s.players[0].alive).toBe(false);});
it.each([[38,44],[34,48]])('moves a lone trebuchet into occupation after destroying a capital inside walls %i..%i', (low,high)=>{
 const{s,target,army}=siege();for(const e of army)delete s.entities[e.id];
 const guard=spawn(s,'unit','trebuchet',1,{x:31,y:40});s.players[1].ai.target=target.id;
 for(let x=low;x<=high;x++)for(let y=low;y<=high;y++)if(x===low||x===high||y===low||y===high)spawn(s,'building','palisade',0,{x,y});
 updateVisibility(s);step(s,4000);
 expect(target.owner).toBe(1);expect(s.players[0].alive).toBe(false);
 expect(distance(guard,{x:41.5,y:41.5})).toBeLessThan(6);
});

