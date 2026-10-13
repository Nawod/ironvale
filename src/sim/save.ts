import type {GameState} from './types';
import {BUILDINGS,UNITS} from './definitions';
export function encodeSave(s:GameState):string{return JSON.stringify(s);}
export function decodeSave(text:string):GameState{
 let s:GameState;try{s=JSON.parse(text);}catch{throw new Error('This save is damaged and cannot be loaded.');}
 if(!s||typeof s!=='object'||s.version===undefined)throw new Error('This is not an Ironvale save.');
 if(s.version!==1)throw new Error('This save version is incompatible with this version of Ironvale.');
 const valid=Number.isInteger(s.tick)&&s.tick>=0&&Number.isInteger(s.rng)&&Number.isInteger(s.nextId)&&s.config&&[1,3].includes(s.config.opponents)&&['easy','normal','hard'].includes(s.config.difficulty)&&s.size===(s.config.opponents===1?96:128)&&Array.isArray(s.terrain)&&s.terrain.length===s.size*s.size&&Array.isArray(s.players)&&s.players.length===s.config.opponents+1&&s.entities&&typeof s.entities==='object'&&Array.isArray(s.events)&&Array.isArray(s.intel)&&s.intel.length===s.players.length&&Array.isArray(s.explored)&&Array.isArray(s.visible);
 if(!valid)throw new Error('This save is damaged or incomplete.');
 for(const p of s.players){if(!s.entities[p.capital]||p.id<0||p.id>=s.players.length||![1,2,3].includes(p.age)||!p.ai||!p.resources||Object.values(p.resources).some(v=>!Number.isFinite(v)||v<0))throw new Error('This save contains invalid empire data.');}
 for(const arrays of [s.explored,s.visible])if(arrays.length!==s.players.length||arrays.some(a=>!Array.isArray(a)||a.length!==s.size*s.size))throw new Error('This save contains invalid map data.');
 for(const e of Object.values(s.entities)){if(!Number.isInteger(e.id)||e.id>=s.nextId||!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.y<0||e.x>=s.size||e.y>=s.size||!e.order||!Array.isArray(e.path)||!Array.isArray(e.queue)||!Array.isArray(e.garrison)||!Number.isFinite(e.hp)||e.kind==='unit'&&!UNITS[e.type as keyof typeof UNITS]||e.kind==='building'&&!BUILDINGS[e.type as keyof typeof BUILDINGS])throw new Error('This save contains invalid unit or building data.');}
 return s;
}
