import {it,expect} from 'vitest';
import {Worker} from 'node:worker_threads';
import {createGame,spawn} from '../src/sim/world';
import {encodeSave,decodeSave} from '../src/sim/save';
import {updateVisibility} from '../src/sim/visibility';
it('the online match worker restores neutral night raids, publishes both cities and keeps homes in checkpoints',async()=>{
 const s=createGame({opponents:1,difficulty:'normal',seed:42,zombies:true});s.players.forEach(p=>p.controller='human');s.tick=12000;s.zombieNight=0;
 for(const p of s.players){const cap=s.entities[p.capital],z=spawn(s,'unit','zombie',-2,{x:cap.x-1,y:cap.y});z.home={x:40.5,y:40.5};}
 const home=structuredClone(Object.values(s.entities).find(e=>e.type==='zombie')!.home);updateVisibility(s);
 const worker=new Worker(new URL('../dist-server/match-worker.mjs',import.meta.url),{workerData:{state:encodeSave(s)}}),messages:any[]=[];worker.on('message',m=>messages.push(m));
 try{
  await expect.poll(()=>messages.filter(m=>m.type==='snapshot'&&m.snapshot.tick>12004).length,{timeout:10000}).toBeGreaterThanOrEqual(2);
  for(const p of s.players){const view=messages.filter(m=>m.type==='snapshot'&&m.player===p.id).at(-1).snapshot;expect(view.config.zombies).toBe(true);expect(view.entities.some((e:any)=>e.owner===-2&&e.type==='zombie')).toBe(true);expect(view.players[1-p.id].resources.food).toBe(0);}
  messages.length=0;worker.postMessage({type:'checkpoint'});await expect.poll(()=>messages.some(m=>m.type==='checkpoint'),{timeout:5000}).toBe(true);const saved=decodeSave(messages.find(m=>m.type==='checkpoint').state);
  expect(Object.values(saved.entities).filter(e=>e.type==='capital').every(e=>e.hp<e.maxHp)).toBe(true);expect(Object.values(saved.entities).find(e=>e.type==='zombie')!.home).toEqual(home);expect(saved.zombieNight).toBe(0);
 }finally{await worker.terminate();}
});
