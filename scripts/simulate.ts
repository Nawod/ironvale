import {createGame} from '../src/sim/world';
import {step} from '../src/sim/engine';
import {updateAI} from '../src/sim/ai';
import {writeFileSync,mkdirSync} from 'node:fs';
const opponents=(Number(process.argv[2])===1?1:3) as 1|3,max=Number(process.argv[3])||36000;
const seed=Number(process.argv[4])||42;
const s=createGame({opponents,difficulty:'hard',seed}),started=performance.now(),captures:unknown[]=[];let eventId=0;
for(let i=0;i<max&&s.winner===null;i++){
 updateAI(s,true);step(s,1,false);
 for(const e of s.events)if(e.id>eventId&&e.kind==='capture')captures.push(e);eventId=s.nextEvent-1;
 if(i%2400===0)console.log(JSON.stringify({seconds:s.tick/20,empires:s.players.map(p=>({name:p.name,alive:p.alive,age:p.age,resources:Object.fromEntries(Object.entries(p.resources).map(([k,v])=>[k,Math.round(v)])),units:Object.values(s.entities).filter(e=>e.owner===p.id&&e.kind==='unit').length,buildings:Object.values(s.entities).filter(e=>e.owner===p.id&&e.kind==='building').length,raids:p.ai.raids}))}));
}
mkdirSync('test-results',{recursive:true});writeFileSync(`test-results/headless-${opponents+1}.json`,JSON.stringify(s));
console.log(JSON.stringify({winner:s.winner,seconds:s.tick/20,elapsedMs:Math.round(performance.now()-started),captures}));
if(s.winner===null)process.exitCode=1;
