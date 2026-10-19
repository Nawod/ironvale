import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {UnitTactics} from '../src/ui/UnitTactics';
import {createGame,spawn} from '../src/sim/world';
import {snapshot} from '../src/sim/visibility';

it('explains a selected troop counter and the bounded potential range without showing it as earned damage',()=>{
 const world=createGame({opponents:1,difficulty:'easy',seed:42}),archer=spawn(world,'unit','archer',0,{x:20,y:20}),s=snapshot(world);
 const html=renderToStaticMarkup(createElement(UnitTactics,{unit:archer,snapshot:s}));expect(html).toContain('11 attack');expect(html).toContain('6 range');expect(html).toContain('up to 7.2 downhill');expect(html).toContain('Spearmen');expect(html).not.toContain('damage bonus');
 const spear=spawn(world,'unit','spearman',0,{x:20,y:20}),spearHtml=renderToStaticMarkup(createElement(UnitTactics,{unit:spear,snapshot:s}));expect(spearHtml).toContain('Mounted units');expect(spearHtml).not.toContain('downhill');
});
