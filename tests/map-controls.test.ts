import {it,expect,vi} from 'vitest';
import {Battlefield} from '../src/render/battlefield';
it('an immediate touch drag keeps panning and cancels the selection hold',()=>{
 vi.useFakeTimers();try{const select=vi.fn(),field=new Battlefield({} as HTMLElement,{select,action:vi.fn(),cancel:vi.fn(),error:vi.fn()}) as any;field.app={canvas:{setPointerCapture:vi.fn(),getBoundingClientRect:()=>({left:0,top:0})}};field.zoom=1;field.camera={x:100,y:100};
 const event={clientX:50,clientY:50,pointerId:1,pointerType:'touch',button:0,ctrlKey:false,shiftKey:false};field.down(event);field.move({...event,clientX:80,clientY:70});vi.advanceTimersByTime(600);field.up({...event,clientX:80,clientY:70});expect(field.camera).toEqual({x:70,y:80});expect(select).not.toHaveBeenCalled();
 }finally{vi.useRealTimers();}
});
it('hold and drag selects several owned units on touch without panning',()=>{
 vi.useFakeTimers();try{const select=vi.fn(),field=new Battlefield({} as HTMLElement,{select,action:vi.fn(),cancel:vi.fn(),error:vi.fn()}) as any;
 field.app={canvas:{setPointerCapture:vi.fn(),getBoundingClientRect:()=>({left:0,top:0})}};field.snapshot={playerId:0,entities:[]};field.hit=()=>undefined;field.worldToScreen=(e:any)=>({x:e.x,y:e.y});field.camera={x:100,y:100};
 field.snapshot.entities=[{id:1,owner:0,kind:'unit',x:70,y:70},{id:2,owner:0,kind:'unit',x:80,y:80},{id:3,owner:1,kind:'unit',x:75,y:75}];
 const event={clientX:50,clientY:50,pointerId:1,pointerType:'touch',button:0,ctrlKey:false,shiftKey:false};field.down(event);vi.advanceTimersByTime(450);field.move({...event,clientX:100,clientY:100});field.up({...event,clientX:100,clientY:100});
 expect(select).toHaveBeenCalledWith([1,2],false);expect(field.camera).toEqual({x:100,y:100});
 }finally{vi.useRealTimers();}
});
it('rotates with Ctrl plus left drag and preserves selection instead of issuing commands',()=>{
 const hooks={select:vi.fn(),action:vi.fn(),cancel:vi.fn(),error:vi.fn()};const field=new Battlefield({} as HTMLElement,hooks) as any;
 field.app={canvas:{setPointerCapture:vi.fn(),getBoundingClientRect:()=>({left:0,top:0})}};field.zoom=2;field.camera={x:100,y:100};
 const event={clientX:50,clientY:50,pointerId:1,pointerType:'mouse',button:0,ctrlKey:true,shiftKey:false};
 field.down(event);field.move({...event,clientX:90,clientY:70});field.up({...event,clientX:90,clientY:70});
 expect(field.camera).toEqual({x:100,y:100});expect(field.yaw).not.toBeCloseTo(Math.PI/4);expect(hooks.select).not.toHaveBeenCalled();expect(hooks.action).not.toHaveBeenCalled();
});

it('touch taps issue contextual orders with selected units while friendly units remain selectable',()=>{
 const hooks={select:vi.fn(),action:vi.fn(),cancel:vi.fn(),error:vi.fn()},field=new Battlefield({} as HTMLElement,hooks) as any;field.app={canvas:{setPointerCapture:vi.fn(),getBoundingClientRect:()=>({left:0,top:0})}};field.snapshot={playerId:0,entities:[{id:1,kind:'unit',type:'villager',owner:0}]};field.selection=[1];field.screenToWorld=()=>({x:10,y:10});const tree={id:2,kind:'resource',type:'wood',owner:-1};field.hit=()=>tree;const event={clientX:50,clientY:50,pointerId:1,pointerType:'touch',button:0,ctrlKey:false,shiftKey:false};field.down(event);field.up(event);expect(hooks.action).toHaveBeenCalledWith({x:10,y:10},tree);expect(hooks.select).not.toHaveBeenCalled();field.hit=()=>field.snapshot.entities[0];field.down(event);field.up(event);expect(hooks.select).toHaveBeenCalled();
});

it('middle-button drag pans while two-finger twist rotates and expands zoom',()=>{
 const hooks={select:vi.fn(),action:vi.fn(),cancel:vi.fn(),error:vi.fn()},field=new Battlefield({} as HTMLElement,hooks) as any;field.app={canvas:{setPointerCapture:vi.fn(),getBoundingClientRect:()=>({left:0,top:0})},screen:{width:900,height:600}};field.camera={x:100,y:100};const mouse={clientX:50,clientY:50,pointerId:1,pointerType:'mouse',button:1,ctrlKey:false,shiftKey:false};field.down(mouse);field.move({...mouse,clientX:80,clientY:70});field.up({...mouse,clientX:80,clientY:70});expect(field.camera).toEqual({x:70,y:80});const touch={...mouse,pointerType:'touch',button:0};field.down({...touch,clientX:100,clientY:100});field.down({...touch,pointerId:2,clientX:200,clientY:100});field.move({...touch,pointerId:2,clientX:100,clientY:250});expect(field.zoom).toBeCloseTo(1.5);expect(field.yaw).toBeCloseTo(3*Math.PI/4);field.up(touch);field.up({...touch,pointerId:2});expect(hooks.action).not.toHaveBeenCalled();expect(hooks.select).not.toHaveBeenCalled();
});

it.each(['mouse','touch'])('%s assigns selected villagers to an unfinished friendly building',pointerType=>{const hooks={select:vi.fn(),action:vi.fn(),cancel:vi.fn(),error:vi.fn()},field=new Battlefield({} as HTMLElement,hooks) as any;field.app={canvas:{setPointerCapture:vi.fn(),getBoundingClientRect:()=>({left:0,top:0})}};field.snapshot={playerId:0,entities:[{id:1,kind:'unit',type:'villager',owner:0}]};field.selection=[1];field.screenToWorld=()=>({x:10,y:10});const building={id:2,kind:'building',type:'house',owner:0,progress:.5,hp:200};field.hit=()=>building;const event={clientX:50,clientY:50,pointerId:1,pointerType,button:0,ctrlKey:false,shiftKey:false};field.down(event);field.up(event);expect(hooks.action).toHaveBeenCalledWith({x:10,y:10},building);expect(hooks.select).not.toHaveBeenCalled();});
