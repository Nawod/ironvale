import {expect,it} from 'vitest';
import {Battlefield} from '../src/render/battlefield';
import {createGame} from '../src/sim/world';
import {snapshot} from '../src/sim/visibility';

it('resizes adaptive drawing buffers before presenting a frame so quality changes cannot clear the displayed world',()=>{
 const calls:string[]=[],field=new Battlefield({} as HTMLElement,{select:()=>{},action:()=>{},cancel:()=>{},error:()=>{}}) as any;
 field.app.screen={width:1200,height:900};field.update({...snapshot(createGame({opponents:1,difficulty:'easy',seed:42})),entities:[]});field.renderer={render:()=>calls.push('render'),setPixelRatio:()=>calls.push('resize'),shadowMap:{enabled:false}};
 field.frameAverage=25;field.qualityFrames=91;field.pixelRatio=1.5;field.lastTime=performance.now()-25;
 try{field.draw();expect(calls).toEqual(['resize','render']);expect(field.pixelRatio).toBe(1.35);}
 finally{field.batches.dispose();field.models.dispose();field.ring.dispose();field.bar.dispose();for(const m of [...field.barMaterials,...field.selectionMaterials])m.dispose();field.preview.geometry.dispose();field.preview.material.dispose();}
});
