import {UNITS} from '../sim/definitions';
import {attackRange} from '../sim/combat-tactics';
import type {Entity,Snapshot,UnitType} from '../sim/types';

const roles:Partial<Record<UnitType,string>>={spearman:'Mounted units are the preferred target.',pikeman:'Mounted units are the preferred target.',cavalry:'Archers and crossbowmen are the preferred targets.',heavyCavalry:'Archers and crossbowmen are the preferred targets.',archer:'Spearmen and pikemen are the preferred targets.',crossbowman:'Spearmen and pikemen are the preferred targets.',ram:'Built to break fortifications.',trebuchet:'Arcing siege fire against fortifications.',scout:'Fast reconnaissance and wide vision.',zombie:'Night raider · retreats to the forest at dawn.'};
export function UnitTactics({unit,snapshot:s}:{unit:Entity;snapshot:Snapshot}){
 const def=UNITS[unit.type as UnitType];if(unit.kind!=='unit'||!def)return null;
 const range=attackRange(s,unit),owner=s.players[unit.owner],damage=def.damage+(owner?.weapons??0)*3,armor=def.armor+(owner?.armor??0)*2;
 return <aside className="unit-tactics" aria-label="Unit tactics"><p><strong>{damage} attack</strong><span>{armor} armor</span><span>{range.base} range</span></p><small>{roles[unit.type as UnitType]}{range.bonus>0&&<> Range up to {Number(range.max.toFixed(1))} downhill; mountains can block fire.</>}</small></aside>;
}
