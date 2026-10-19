import {expect,it} from 'vitest';
import {Box3,Vector3} from 'three';
import {commandPortrait,lankaPortraitCatalog,portraitCatalog} from '../src/render/portraits';
import {portraitFraming} from '../src/render/portrait-baker';
import {FACTIONS} from '../src/sim/factions';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {EntityPortrait} from '../src/ui/EntityPortrait';

it('uses faction-prefixed art only for native-covered troops and capital cities, preserving legacy URLs',()=>{
 expect(commandPortrait('spearman',2,3,undefined,'kandy')).toBe('./art/portraits/lanka-kandy-spearman-2-age1.webp');
 expect(commandPortrait('capital',2,3,undefined,'kandy')).toBe('./art/portraits/lanka-kandy-capital-2-age3.webp');
 for(const type of ['wall','gate','fortress','villager','cavalry','zombie','wood'] as const)expect(commandPortrait(type,2,3,undefined,'ravana')).toBe(commandPortrait(type,2,3));
 expect(commandPortrait('warElephant',0)).toBe(commandPortrait('warElephant',0,1,undefined,'anuradhapura'));
 expect(commandPortrait('danduMonara',0)).toBe(commandPortrait('danduMonara',0,1,undefined,'ravana'));
 expect(commandPortrait('capital',NaN,Infinity,undefined,'british')).toBe('./art/portraits/lanka-british-capital-0-age1.webp');
 expect(commandPortrait('spearman',0,1,undefined,'untrusted/..' as any)).toBe(commandPortrait('spearman',0));
});
it('enumerates exactly 1040 unique bounded faction portraits covering all ten kingdoms and every dynamic default URL',()=>{
 const catalog=lankaPortraitCatalog(),urls=new Set(catalog.map(p=>p.url));expect(catalog.length).toBe(1040);expect(urls.size).toBe(1040);
 expect(catalog.every(p=>p.faction&&Object.hasOwn(FACTIONS,p.faction)&&p.owner>=0&&p.owner<8&&p.age>=1&&p.age<=3)).toBe(true);
 for(const faction of Object.keys(FACTIONS))expect(catalog.filter(p=>p.faction===faction)).toHaveLength(104);
 for(const record of portraitCatalog())if(record.url.includes('/lanka-'))expect(urls.has(record.url)).toBe(true);
 expect(catalog.every(p=>p.url.endsWith('.webp')&&!p.url.includes('/../'))).toBe(true);
});
it('fits elephant/cannon/aircraft/legendary giant silhouettes and crops actual human heads and uniforms',()=>{
 const b=new Box3(new Vector3(-3,0,-2),new Vector3(3,4,2));
 for(const type of ['warElephant','cannon','danduMonara'] as const){const f=portraitFraming('unit',type,b,'ravana');expect(f.bounds).toEqual(b);expect(f.half).toBeUndefined();}
 expect(portraitFraming('unit','champion',b,'ravana').bounds).toEqual(b);
 expect(portraitFraming('unit','rifleman',b,'british').half).toBeGreaterThan(.95);
 const human=portraitFraming('unit','musketeer',b,'kandy');expect(human.center.y).toBeGreaterThan(1.2);expect(human.center.y).toBeLessThan(1.6);expect(human.half).toBeGreaterThan(.62);expect(human.bounds.max.y).toBeLessThan(b.max.y);
 expect(portraitFraming('building','capital',b,'kandy').bounds).toEqual(b);
});
it('passes the faction through the EntityPortrait component',()=>{
 const html=renderToStaticMarkup(createElement(EntityPortrait,{type:'rifleman',owner:4,faction:'british'}));
 expect(html).toContain('lanka-british-rifleman-4-age1.webp');
});
