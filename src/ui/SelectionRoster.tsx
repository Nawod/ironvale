import {UNITS} from '../sim/definitions';
import type {Entity,FactionId} from '../sim/types';
import {unitName} from '../sim/factions';
import {selectionGroups} from './selection';
import {EntityPortrait} from './EntityPortrait';

export function SelectionRoster({selected,playerId,select,className='',faction}:{selected:Entity[];playerId:number;select:(ids:number[])=>void;className?:string;faction?:FactionId}){
 const groups=selectionGroups(selected,playerId);if(groups.length<2)return null;
 return <div className={`selection-roster ${className}`} role="group" aria-label="Army composition">{groups.map(group=><button key={group.type} title={`Select ${unitName(group.type,{faction})} group (${group.count})`} aria-label={`Select ${unitName(group.type,{faction})} group (${group.count})`} onClick={()=>select(group.ids)}><EntityPortrait type={group.type} owner={playerId} faction={faction}/><span>{group.count}</span></button>)}</div>;
}
