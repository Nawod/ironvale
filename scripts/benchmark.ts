import {createGame,spawn} from '../src/sim/world';
import {step} from '../src/sim/engine';
import {writeFileSync,mkdirSync} from 'node:fs';
const s=createGame({opponents:3,difficulty:'hard',seed:42});
for(const e of Object.values(s.entities))if(e.kind==='unit')delete s.entities[e.id];
for(const p of s.players){const cap=s.entities[p.capital];p.ai.nextThink=1e9;for(let i=0;i<100;i++){const u=spawn(s,'unit',i%4===0?'archer':'spearman',p.id,{x:cap.x+4+i%10*.5,y:cap.y+4+Math.floor(i/10)*.5});u.stance='hold';u.order={kind:'move',point:{x:cap.x-3+(i%10),y:cap.y+6+Math.floor(i/10)}};}}
const timings:number[]=[];for(let i=0;i<1200;i++){const t=performance.now();step(s);timings.push(performance.now()-t);}
timings.sort((a,b)=>a-b);const report={units:Object.values(s.entities).filter(e=>e.kind==='unit').length,ticks:1200,meanMs:timings.reduce((a,b)=>a+b,0)/timings.length,p95Ms:timings[Math.floor(timings.length*.95)],maxMs:Math.max(...timings),tickBudgetMs:50};
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/simulation-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.p95Ms>=50)process.exitCode=1;
