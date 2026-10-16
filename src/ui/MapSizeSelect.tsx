import type {MapSize} from '../sim/types';
import {battlefieldSize} from '../sim/map-generation';

export const MAP_SIZE_LABELS:Record<MapSize,string>={standard:'Standard',large:'Large',huge:'Huge'};
export function mapSizeSummary(size:MapSize='large',players=2):string{
 const tiles=battlefieldSize(players,size);return `${MAP_SIZE_LABELS[size]} · ${tiles} × ${tiles} tiles`;
}
export function MapSizeSelect({value,players,onChange,label='Map size'}:{value:MapSize;players:number;onChange:(size:MapSize)=>void;label?:string}){
 return <label>Map size<select aria-label={label} value={value} onChange={e=>onChange(e.target.value as MapSize)}>{(['standard','large','huge'] as const).map(size=><option key={size} value={size}>{mapSizeSummary(size,players)}</option>)}</select><small>Scales with the number of empires. Huge is always 256 × 256.</small></label>;
}
