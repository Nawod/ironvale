import {test,expect} from '@playwright/test';
test('first online interaction unlocks audio and produces a measurable signal',async({page})=>{
 await page.addInitScript(()=>{
  const Native=window.AudioContext;
  window.AudioContext=class extends Native {
   meter:AnalyserNode;
   constructor(){super();this.meter=this.createAnalyser();this.meter.connect(this.destination);(window as any).__testAudio=this;}
   createGain(){const node=super.createGain(),connect=node.connect.bind(node) as any;node.connect=((target:any,...args:any[])=>connect(target===this.destination?this.meter:target,...args)) as any;return node;}
  };
 });
 await page.goto('/');await page.getByRole('button',{name:'Play online',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>{const ctx=(window as any).__testAudio;if(!ctx||ctx.state!=='running')return 0;const samples=new Uint8Array(ctx.meter.frequencyBinCount);ctx.meter.getByteFrequencyData(samples);return Math.max(...samples);})).toBeGreaterThan(8);
});
test('touch hold and drag selects several villagers',async({page,context},info)=>{
 test.skip(info.project.name==='desktop');await page.goto('/');await page.getByRole('button',{name:'Begin your reign'}).click();await expect(page.getByTestId('population')).toContainText('7 / 15');
 const box=(await page.locator('[data-testid="battlefield"] canvas').boundingBox())!,zoom=info.project.name==='phone'?.92:1.1,origin=box.y+box.height*(box.width<700?.35:.42);
 const x=box.x+box.width/2-5.3*32*zoom,y=origin-3*16*zoom,endX=box.x+box.width/2+16*zoom,endY=origin+5*16*zoom;
 const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:endX,y:endY}]});await page.waitForTimeout(550);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.getByRole('button',{name:'Build House',exact:true})).toBeVisible();await expect(page.locator('.selection-panel')).toContainText('6');await expect(page.locator('.building-buttons .active')).toHaveCount(0);
 await page.screenshot({path:`test-results/${info.project.name}-touch-group.png`});
});
