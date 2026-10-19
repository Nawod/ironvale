import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FactionSelect} from '../src/ui/FactionSelect';
import {CommandPanel} from '../src/ui/CommandPanel';
import {UnitTactics} from '../src/ui/UnitTactics';
import {createGame,spawn} from '../src/sim/world';
import {snapshot} from '../src/sim/visibility';

it('offers all ten factions, makes legendary status explicit and describes real specialties',()=>{
 const html=renderToStaticMarkup(createElement(FactionSelect,{value:'ravana',onChange:()=>{}}));expect((html.match(/<option /g)??[]).length).toBe(10);expect(html).toContain('Legendary');expect(html).toContain('Dandu Monara');expect(html).toContain('Cross-era');expect(html).toContain('Kingdom and army');
});
function panel(faction:'british'|'polonnaruwa'|'dutch',type:'range'|'market'|'villager'){
 const s=createGame({opponents:1,difficulty:'normal',seed:42,faction});s.players[0].age=3;const e=spawn(s,type==='villager'?'unit':'building',type,0,{x:23,y:23});return renderToStaticMarkup(createElement(CommandPanel,{snapshot:snapshot(s),selected:[e],mode:'',issue:()=>{},select:()=>{},setMode:()=>{},setPlacement:()=>{}}));
}
it('shows the British firearm roster and its population costs in training',()=>{const html=panel('british','range');expect(html).toContain('Recruit Musketeer');expect(html).toContain('Recruit Rifleman');expect(html).toContain('2 population');expect(html).not.toContain('Recruit War elephant');});
it('shows faction-modified stats in the selected soldier readout',()=>{const s=createGame({opponents:1,difficulty:'normal',seed:42,faction:'chola'}),e=spawn(s,'unit','spearman',0,{x:21,y:22});const html=renderToStaticMarkup(createElement(UnitTactics,{unit:e,snapshot:snapshot(s)}));expect(html).toContain('12.65');expect(html).toContain('Mounted');});
