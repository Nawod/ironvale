import {UNITS} from '../sim/definitions';
import type {Entity} from '../sim/types';
import {selectionGroups} from './selection';
import {EntityPortrait} from './EntityPortrait';

export function SelectionRoster({selected,playerId,select,className=''}:{selected:Entity[];playerId:number;select:(ids:number[])=>void;className?:string}){
 const groups=selectionGroups(selected,playerId);if(groups.length<2)return null;
 return <div className={`selection-roster ${className}`} role="group" aria-label="Army composition">{groups.map(group=><button key={group.type} title={`Select ${UNITS[group.type].name} group (${group.count})`} aria-label={`Select ${UNITS[group.type].name} group (${group.count})`} onClick={()=>select(group.ids)}><EntityPortrait type={group.type} owner={playerId}/><span>{group.count}</span></button>)}</div>;
}
