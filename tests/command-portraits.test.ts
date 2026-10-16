import {expect,it} from 'vitest';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {commandPortrait,portraitCatalog} from '../src/render/portraits';
import {BUILDINGS,UNITS} from '../src/sim/definitions';

it('uses the right city, building age and wall tier without unbounded lookup keys',()=>{
 expect(commandPortrait('capital',2,3)).toBe('./art/portraits/capital-2-age3.webp');
 expect(commandPortrait('wall',2,3,3)).toBe('./art/portraits/wall-2-reinforced.webp');
 expect(commandPortrait('palisade',2,3)).toBe(commandPortrait('palisade',2,1));
 expect(commandPortrait('villager',NaN,Infinity)).toBe(commandPortrait('villager',0,1));
 expect(commandPortrait('capital',999,999)).toBe(commandPortrait('capital',7,3));
 expect(commandPortrait('zombie',7,3)).toBe(commandPortrait('zombie',0,1));
 expect(commandPortrait('untrusted/type' as any)).toBeUndefined();
});
it('ships real WebP files for every unit, city, building age and reinforced tier within the image budget',()=>{
 const catalog=portraitCatalog(),urls=new Set(catalog.map(p=>p.url));expect(catalog.length).toBe(urls.size);
 for(let owner=0;owner<8;owner++){
  for(const type of Object.keys(UNITS))expect(urls.has(commandPortrait(type as any,owner)!)).toBe(true);
  for(const type of Object.keys(BUILDINGS))for(const age of [1,2,3])expect(urls.has(commandPortrait(type as any,owner,age)!)).toBe(true);
  expect(urls.has(commandPortrait('wall',owner,3,3)!)).toBe(true);
 }
 let bytes=0;for(const url of urls){const path=`public/${url.slice(2)}`,data=readFileSync(path);expect(data.toString('ascii',0,4)).toBe('RIFF');expect(data.toString('ascii',8,12)).toBe('WEBP');expect(data.toString('ascii',12,16)).toBe('VP8X');expect(data.readUIntLE(24,3)+1).toBe(192);expect(data.readUIntLE(27,3)+1).toBe(192);bytes+=statSync(path).size;}
 expect(bytes).toBeLessThan(12*1024*1024);
 for(const type of ['villager','capital'] as const){const hashes=Array.from({length:8},(_,owner)=>createHash('sha256').update(readFileSync(`public/${commandPortrait(type,owner)!.slice(2)}`)).digest('hex'));expect(new Set(hashes).size).toBe(8);}
});
