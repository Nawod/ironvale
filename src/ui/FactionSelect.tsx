import {useId} from 'react';
import {FACTIONS,factionFor} from '../sim/factions';
import type {FactionId} from '../sim/types';
import './factions.css';

export function FactionCrest({faction='anuradhapura',className=''}:{faction?:FactionId;className?:string}){
 const style=FACTIONS[faction].architecture;
 return <svg className={`faction-crest ${className}`} viewBox="0 0 64 72" aria-hidden="true"><path d="M6 5h52v38c0 12-26 24-26 24S6 55 6 43Z" fill={style==='legendary'?'#294d48':style==='colonial'?'#303f52':style==='dravidian'?'#703a28':'#692d30'} stroke="#c8ad70" strokeWidth="2"/><circle cx="32" cy="19" r="6" fill="#d9bc77"/>{style==='colonial'?<path d="M17 49V35h7v-6h16v6h7v14M24 49V37h16v12M15 54h34M27 29v-5m10 5v-5"/>:style==='legendary'?<path d="m12 36 20 12 20-12-10 17H22ZM32 43V29m-9 8 9-8 9 8M26 56h12"/>:style==='dravidian'?<path d="m20 49 3-7h18l3 7M23 42l3-7h12l3 7M26 35l3-7h6l3 7M17 54h30M28 49v5m8-5v5"/>:<path d="M17 51V38l15-10 15 10v13M13 39h38M22 51V40m10 11V40m10 11V40M13 56h38"/>}</svg>;
}
export function FactionSelect({value,onChange,label='Kingdom and army',disabled=false,compact=false}:{value:FactionId;onChange:(value:FactionId)=>void;label?:string;disabled?:boolean;compact?:boolean}){
 const id=useId(),f=FACTIONS[value];
 return <section className={`faction-select ${compact?'compact':''}`} aria-label={label}><div className="faction-heading"><FactionCrest faction={value}/><label htmlFor={id}>{label}<select id={id} aria-label={label} value={value} disabled={disabled} onChange={e=>onChange(e.target.value as FactionId)}><optgroup label="Historical kingdoms and armies">{Object.values(FACTIONS).filter(f=>f.category==='historical').map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</optgroup><optgroup label="Legendary Lanka"><option value="ravana">Ravana · Legendary</option></optgroup></select></label></div><div className="faction-description" aria-live="polite"><p><strong>{f.category==='legendary'?'Legendary · ':''}{f.era}</strong> · {f.summary}</p><ul>{f.specialties.map(s=><li key={s}>{s}</li>)}</ul>{!compact&&<small>Cross-era skirmish · Historical inspiration and legend meet on one battlefield.</small>}</div></section>;
}
export function FactionBadge({faction}:{faction?:FactionId}){const f=factionFor({faction});return f?<span className="faction-badge"><FactionCrest faction={f.id}/>{f.name}{f.category==='legendary'?' · Legendary':''}</span>:null;}
export function FactionGuide(){return <details className="faction-dossier"><summary>Kingdoms, specialties and legendary armies</summary><div>{Object.values(FACTIONS).map(f=><p key={f.id}><strong>{f.name}{f.category==='legendary'?' · Legendary':''}</strong> — {f.specialties.join(' · ')}</p>)}<p>These are cross-era game rules inspired by history and folklore. Bonuses and shared troop choices are designed for play; they do not assert historical technological superiority.</p></div></details>;}
