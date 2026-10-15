import type {GameState} from './types';
export type Weather='clear'|'overcast'|'fog'|'rain'|'storm';
export interface Environment {hour:number;day:number;daylight:number;weather:Weather;cloud:number;rain:number;mist:number;wind:number;windAngle:number;movement:number}
const DAY=24*60*20,PERIOD=3*60*20,TRANSITION=30*20;
const profiles=[{weather:'clear',cloud:.16,rain:0,mist:.03,wind:.25},{weather:'overcast',cloud:.75,rain:0,mist:.12,wind:.4},{weather:'fog',cloud:.5,rain:0,mist:.7,wind:.14},{weather:'rain',cloud:.9,rain:.65,mist:.25,wind:.6},{weather:'storm',cloud:1,rain:1,mist:.36,wind:1}] as const;
function hash(seed:number,phase:number):number{let n=Math.imul((seed^Math.imul(phase,0x9e3779b1))>>>0,0x85ebca6b);n^=n>>>13;return Math.imul(n,0xc2b2ae35)>>>0;}
export function environmentAt(tick:number,seed:number):Environment{
 const time=Math.max(0,tick),phase=Math.floor(time/PERIOD),target=profiles[phase===0?0:hash(seed,phase)%profiles.length],previous=profiles[phase<=1?0:hash(seed,phase-1)%profiles.length];
 const t=Math.min(1,(time%PERIOD)/TRANSITION),blend=t*t*(3-2*t),mix=(a:number,b:number)=>a+(b-a)*blend,hour=(8+time/DAY*24)%24;
 const rain=mix(previous.rain,target.rain),daylight=Math.max(0,Math.sin((hour-6)/24*Math.PI*2));
 return{hour,day:1+Math.floor((time/DAY*24+8)/24),daylight,weather:blend<.5?previous.weather:target.weather,cloud:mix(previous.cloud,target.cloud),rain,mist:mix(previous.mist,target.mist),wind:mix(previous.wind,target.wind),windAngle:(hash(seed,0)/0xffffffff)*Math.PI*2,movement:1-rain*.12};
}
const cache=new WeakMap<GameState,{tick:number;value:Environment}>();
export function environmentFor(s:GameState):Environment{let entry=cache.get(s);if(!entry||entry.tick!==s.tick){entry={tick:s.tick,value:environmentAt(s.tick,s.config.seed)};cache.set(s,entry);}return entry.value;}
export function timeLabel(e:Environment):string{const minutes=Math.floor(e.hour*60);return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
