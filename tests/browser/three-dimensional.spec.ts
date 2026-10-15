import {test,expect} from '@playwright/test';
import {RTSCamera} from '../../src/render/camera3d';
import {openCommands} from './hud-helpers';

test('rotated 3D building picking and ground placement preserve gameplay',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Begin your reign'}).click();
 await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('aria-label','3D battlefield');
 const viewport=page.viewportSize()!,camera=new RTSCamera(),zoom=viewport.width<600?.92:1.1;
 const tap=async(p:{x:number;y:number})=>{if(info.project.name==='desktop')await page.mouse.click(p.x,p.y);else await page.touchscreen.tap(p.x,p.y);};
 await page.getByRole('button',{name:'Camera tools',exact:true}).click();await page.getByRole('button',{name:'Rotate camera right'}).click();await page.getByRole('button',{name:'Rotate camera right'}).click();await page.getByRole('button',{name:'Camera tools',exact:true}).click();
 camera.configure({...viewport,focus:{x:19.5,y:21},zoom,yaw:Math.PI/2,origin:viewport.width<700?.44:.42});
 await tap(camera.project({x:19.5,y:19.5},1));await openCommands(page,'Train');await expect(page.getByRole('button',{name:'Recruit Villager',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Idle villagers'}).click();camera.configure({...viewport,focus:{x:17,y:22},zoom,yaw:Math.PI/2,origin:viewport.width<700?.44:.42});
 const site=info.project.name==='phone'?{x:18.2,y:25.2}:{x:22.2,y:22.2};
 await openCommands(page,'Build');await page.getByRole('button',{name:'Build House',exact:true}).click();const screen=camera.project(site);
 if(info.project.name!=='desktop')await expect(page.getByRole('button',{name:'Open commands',exact:true})).toHaveAttribute('aria-expanded','false');
 expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName,screen)).toBe('CANVAS');
 await tap(screen);await expect(page.getByTestId('population')).toContainText('/ 25',{timeout:20000});
 await expect(page.getByRole('button',{name:'Idle villagers',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Camera tools',exact:true}).click();await page.getByRole('button',{name:'Reset camera'}).click();await page.screenshot({path:`test-results/${info.project.name}-3d.png`});expect(errors).toEqual([]);
});

test('rotated drag panning and touch pinch retain accurate model selection',async({page,context},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Begin your reign'}).click();await expect(page.getByTestId('population')).toContainText('7 / 15');
 const viewport=page.viewportSize()!,zoom=viewport.width<600?.92:1.1,camera=new RTSCamera();
 await page.getByRole('button',{name:'Camera tools',exact:true}).click();await page.getByRole('button',{name:'Rotate camera right'}).click();await page.getByRole('button',{name:'Rotate camera right'}).click();await page.getByRole('button',{name:'Camera tools',exact:true}).click();
 const dx=40,dy=20,start={x:viewport.width/2,y:viewport.height*.4};let finalZoom=zoom;
 if(info.project.name==='desktop'){
  await page.mouse.move(start.x,start.y);await page.mouse.down({button:'middle'});await page.mouse.move(start.x+dx,start.y+dy,{steps:4});await page.mouse.up({button:'middle'});
 }else{
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx,y:start.y+dy}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x-40,y:start.y},{x:start.x+40,y:start.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x-48,y:start.y},{x:start.x+48,y:start.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});finalZoom*=1.2;
 }
 camera.configure({...viewport,focus:{x:19.5,y:21},zoom,yaw:Math.PI/2,origin:viewport.width<700?.44:.42});
 const focus=camera.ground({x:viewport.width/2-dx,y:viewport.height*(viewport.width<700?.44:.42)-dy});
 camera.configure({...viewport,focus,zoom:finalZoom,yaw:Math.PI/2,origin:viewport.width<700?.44:.42});
 const target=camera.project({x:19.5,y:19.5},.8);
 if(info.project.name==='desktop')await page.mouse.click(target.x,target.y);else await page.touchscreen.tap(target.x,target.y);
 await openCommands(page,'Train');await expect(page.getByRole('button',{name:'Recruit Villager',exact:true})).toBeVisible();
});
