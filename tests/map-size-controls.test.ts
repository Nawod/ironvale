import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,expect,it,vi} from 'vitest';
import {OnlineLobby} from '../src/ui/OnlineLobby';
import type {RoomView} from '../src/net/protocol';

afterEach(()=>vi.unstubAllGlobals());
it('shows the authoritative map size and readable dimensions to every room participant',()=>{
 vi.stubGlobal('location',{search:'',origin:'http://localhost',pathname:'/'});vi.stubGlobal('localStorage',{getItem:()=>''});
 const room:RoomView={code:'ABC234',kind:'private',phase:'lobby',hostId:'host',capacity:8,fillAI:false,difficulty:'normal',seed:42,mapType:'riverlands',mapSize:'huge',players:[{id:'host',name:'Host',seat:0,ready:false,connected:true,controller:'human'},{id:'guest',name:'Guest',seat:1,ready:false,connected:true,controller:'human'}]};
 const guest=renderToStaticMarkup(createElement(OnlineLobby,{state:{status:'connected',id:'guest',room},onClose(){}}));
 expect(guest).toContain('Huge');expect(guest).toContain('256 × 256');expect(guest).toContain('Seeded lakes, winding rivers, hills and mountain passes.');
 const host=renderToStaticMarkup(createElement(OnlineLobby,{state:{status:'connected',id:'host',room},onClose(){}}));
 expect(host).toContain('aria-label="Room map size"');expect(host).toContain('value="huge" selected=""');
});
it('uses joined humans for private map dimensions and all eight empires when AI fill is enabled',()=>{
 vi.stubGlobal('location',{search:'',origin:'http://localhost',pathname:'/'});vi.stubGlobal('localStorage',{getItem:()=>''});
 const room:RoomView={code:'ABC234',kind:'private',phase:'lobby',hostId:'host',capacity:8,fillAI:false,difficulty:'normal',seed:42,mapSize:'standard',players:Array.from({length:3},(_,seat)=>({id:seat?'guest'+seat:'host',name:'Commander',seat,ready:false,connected:true,controller:'human' as const}))};
 const markup=(fillAI:boolean)=>renderToStaticMarkup(createElement(OnlineLobby,{state:{status:'connected',id:'guest1',room:{...room,fillAI}},onClose(){}}));
 expect(markup(false)).toContain('Standard · 160 × 160 tiles');expect(markup(true)).toContain('Standard · 224 × 224 tiles');
});
