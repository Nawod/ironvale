import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
async function localWorker(){const messages:any[]=[];vi.stubGlobal('postMessage',(m:any)=>messages.push(m));vi.stubGlobal('onmessage',undefined);vi.stubGlobal('setInterval',()=>0);await import('../src/worker');const send=(data:any)=>(globalThis as any).onmessage({data});return{messages,send};}
it('echoes each command request ID for local success, rejection and thrown command errors',async()=>{
 const{messages,send}=await localWorker();send({type:'start',config:{opponents:1,difficulty:'easy',seed:42}});const view=messages.find(m=>m.type==='snapshot').snapshot,worker=view.entities.find((e:any)=>e.type==='villager'&&e.owner===0);
 send({type:'command',requestId:201,command:{type:'order',player:0,ids:[worker.id],order:{kind:'idle'}}});expect(messages.filter(m=>m.type==='commandResult').at(-1)).toEqual({type:'commandResult',requestId:201,error:null});
 send({type:'command',requestId:202,command:{type:'buildWallLine',player:0,workers:[worker.id],building:'palisade',start:{x:0,y:0},end:{x:1,y:0}}});expect(messages.filter(m=>m.type==='commandResult').at(-1)).toMatchObject({type:'commandResult',requestId:202,error:expect.any(String)});
 send({type:'command',requestId:203,command:{type:'build',player:0,workers:[worker.id],building:'palisade'}});expect(messages.at(-1)).toMatchObject({type:'commandResult',requestId:203,error:expect.any(String)});expect(messages.some(m=>m.type==='error')).toBe(false);
});
it('returns a correlated error when a command arrives before a game is loaded and preserves legacy result shape',async()=>{
 const{messages,send}=await localWorker();send({type:'command',requestId:204,command:{type:'order',player:0,ids:[1],order:{kind:'idle'}}});expect(messages).toEqual([{type:'commandResult',requestId:204,error:expect.any(String)}]);
 send({type:'start',config:{opponents:1,difficulty:'easy',seed:42}});send({type:'command',command:{type:'order',player:0,ids:[99999],order:{kind:'idle'}}});const result=messages.filter(m=>m.type==='commandResult').at(-1);expect(result).toEqual({type:'commandResult',error:expect.any(String)});expect(result).not.toHaveProperty('requestId');
});
