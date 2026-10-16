import {afterEach,expect,it,vi} from 'vitest';
import {freshSeed,prepareMatchSeed} from '../src/ui/match-seed';

afterEach(()=>vi.unstubAllGlobals());
it('generates a fresh numeric replay seed with browser cryptographic randomness',()=>{
 let value=140;
 vi.stubGlobal('crypto',{getRandomValues:(array:Uint32Array)=>{array[0]=++value;return array;}});
 expect(freshSeed()).toBe('141');expect(freshSeed()).toBe('142');
});
it('consumes the displayed automatic seed and prepares a different seed for the next match',()=>{
 vi.stubGlobal('crypto',{getRandomValues:(array:Uint32Array)=>{array[0]=222;return array;}});
 expect(prepareMatchSeed('111',false)).toEqual({seed:111,nextSeed:'222'});
});
it('preserves an explicitly chosen numeric replay seed across new matches',()=>{
 expect(prepareMatchSeed('918',true)).toEqual({seed:918,nextSeed:'918'});
 expect(prepareMatchSeed('0',true)).toEqual({seed:0,nextSeed:'0'});
});
it('keeps named seeds deterministic and treats an empty seed as automatic',()=>{
 vi.stubGlobal('crypto',{getRandomValues:(array:Uint32Array)=>{array[0]=222;return array;}});
 const first=prepareMatchSeed('Ironvale',true);expect(first.seed).toBe(1450162717);expect(prepareMatchSeed('Ironvale',true)).toEqual(first);
 expect(prepareMatchSeed('  ',true)).toEqual({seed:222,nextSeed:'222'});
});
