import {it,expect,vi} from 'vitest';
import {Soundscape} from '../src/audio';
it('resumes suspended audio before playing a requested effect',async()=>{
 vi.useFakeTimers();const starts=vi.fn(),gain={value:0,setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()};
 const ctx={state:'suspended',currentTime:0,destination:{},createGain:()=>({gain,connect:vi.fn()}),createOscillator:()=>({frequency:{value:0},connect:vi.fn(),start:starts,stop:vi.fn()}),resume:async()=>{await Promise.resolve();ctx.state='running';},close:async()=>{}};
 vi.stubGlobal('AudioContext',class{constructor(){return ctx;}});const sound=new Soundscape();
 try{await sound.play('complete');expect(starts).toHaveBeenCalled();expect(gain.exponentialRampToValueAtTime.mock.calls.some(c=>c[0]>.1)).toBe(true);}finally{sound.destroy();vi.unstubAllGlobals();vi.useRealTimers();}
});
