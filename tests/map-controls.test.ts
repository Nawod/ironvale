import {it,expect,vi} from 'vitest';
import {Battlefield} from '../src/render/battlefield';
it('pans with Ctrl plus left drag and preserves selection instead of issuing commands',()=>{
 const hooks={select:vi.fn(),action:vi.fn(),cancel:vi.fn(),error:vi.fn()};const field=new Battlefield({} as HTMLElement,hooks) as any;
 field.app={canvas:{setPointerCapture:vi.fn(),getBoundingClientRect:()=>({left:0,top:0})}};field.zoom=2;field.camera={x:100,y:100};
 const event={clientX:50,clientY:50,pointerId:1,pointerType:'mouse',button:0,ctrlKey:true,shiftKey:false};
 field.down(event);field.move({...event,clientX:90,clientY:70});field.up({...event,clientX:90,clientY:70});
 expect(field.camera).toEqual({x:80,y:90});expect(hooks.select).not.toHaveBeenCalled();expect(hooks.action).not.toHaveBeenCalled();
});
