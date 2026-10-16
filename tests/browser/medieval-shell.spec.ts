import {expect,test,type Locator,type Page} from '@playwright/test';

async function reachable(control:Locator){
 await control.scrollIntoViewIfNeeded();await expect(control).toBeVisible();
 const r=await control.evaluate(e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{w:b.width,h:b.height,hit:!!hit&&e.contains(hit),font:parseFloat(getComputedStyle(e).fontSize)};});
 expect(r.w).toBeGreaterThanOrEqual(44);expect(r.h).toBeGreaterThanOrEqual(44);expect(r.font).toBeGreaterThanOrEqual(14);expect(r.hit).toBe(true);
}
async function contained(page:Page,selector:string){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const overflow=await page.locator(selector).evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1);}).map(e=>e.className));expect(overflow).toEqual([]);
}

test('matching menu and pop-ups keep navigation and larger text usable in both orientations',async({page},info)=>{
 test.setTimeout(90000);const sizes=info.project.name==='phone'?[{width:390,height:844},{width:844,height:390}]:info.project.name==='tablet'?[{width:768,height:1024},{width:1024,height:768}]:[{width:1440,height:900}];
 for(const size of sizes){
  await page.setViewportSize(size);await page.goto('/');await reachable(page.getByRole('button',{name:'Begin your reign',exact:true}));await contained(page,'.menu-panel,.menu-identity');
  await page.screenshot({path:`test-results/${info.project.name}-${size.width}-medieval-main-menu.png`});
  await page.getByRole('button',{name:'Settings',exact:true}).click();await reachable(page.getByLabel('Interface text size',{exact:true}));await page.getByLabel('Interface text size',{exact:true}).selectOption('large');await reachable(page.getByRole('button',{name:'Test sound',exact:true}));await contained(page,'.modal');
  await page.screenshot({path:`test-results/${info.project.name}-${size.width}-medieval-settings.png`});await page.getByRole('button',{name:'Return to the main menu',exact:true}).click();
  await page.getByRole('button',{name:'How to play',exact:true}).click();await contained(page,'.modal');await page.locator('.help-modal dd').last().scrollIntoViewIfNeeded();await expect(page.locator('.help-modal dd').last()).toBeInViewport();await reachable(page.getByRole('button',{name:'Close help',exact:true}));await page.getByRole('button',{name:'Close help',exact:true}).click();
  await page.getByRole('button',{name:'Begin your reign',exact:true}).click();await page.getByRole('button',{name:'Pause match',exact:true}).click();const menu=page.getByRole('dialog',{name:'Game menu',exact:true});await reachable(menu.getByRole('button',{name:'Save match',exact:true}));await reachable(menu.getByRole('button',{name:'Main menu',exact:true}));await contained(page,'.modal');
  await page.screenshot({path:`test-results/${info.project.name}-${size.width}-medieval-game-menu.png`});await menu.getByRole('button',{name:'Resume match',exact:true}).click();await expect(menu).toHaveCount(0);
 }
});

test('eight-player team lobby keeps city portraits, long names, team and voice controls reachable',async({page},info)=>{
 test.setTimeout(90000);await page.goto('/');await page.getByRole('button',{name:'Play with Freinds',exact:true}).click();await page.getByLabel('Your name').fill('Commander of the Northern Marches');await page.getByRole('button',{name:'Create room',exact:true}).click();await page.getByLabel('Match type',{exact:true}).selectOption('teams');await page.getByRole('button',{name:'Open room',exact:true}).click();const code=(await page.getByTestId('room-code').textContent())!;
 try{
  // Real protocol guests exercise an eight-seat roster without seven extra 3D views.
  await page.evaluate(async code=>{
   const root=window as any;root.__lobbyGuests=[];
   for(let i=1;i<8;i++)await new Promise<void>((resolve,reject)=>{const url=new URL('/ws',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';const ws=new WebSocket(url);root.__lobbyGuests.push(ws);const timer=setTimeout(()=>reject(new Error('Guest join timed out')),5000);ws.onopen=()=>ws.send(JSON.stringify({type:'join',name:`Commander ${i} of the Eastern Realm`,code}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='joined'){clearTimeout(timer);resolve();}else if(m.type==='error'){clearTimeout(timer);reject(new Error(m.error));}};});
  },code);
  await expect(page.locator('.lobby-seat')).toHaveCount(8);const sizes=info.project.name==='phone'?[{width:390,height:844},{width:844,height:390}]:info.project.name==='tablet'?[{width:768,height:1024},{width:1024,height:768}]:[{width:1440,height:900}];
  for(const size of sizes){
   await page.setViewportSize(size);await reachable(page.getByLabel('Team for Commander 7 of the Eastern Realm',{exact:true}));await page.getByLabel('Team for Commander 7 of the Eastern Realm',{exact:true}).selectOption('1');
   const images=page.locator('.lobby-seat>.entity-portrait');await images.last().scrollIntoViewIfNeeded();await expect.poll(()=>images.evaluateAll(es=>es.every(e=>e instanceof HTMLImageElement&&e.naturalWidth===192))).toBe(true);await expect(images.last()).toHaveAttribute('src',/capital-7-age1\.webp$/);
   await reachable(page.getByLabel('Room map type',{exact:true}));await reachable(page.getByRole('button',{name:'Ready',exact:true}));await reachable(page.getByLabel('Voice channel',{exact:true}));await page.getByLabel('Voice channel',{exact:true}).selectOption('team');await expect(page.locator('.voice-audience')).toHaveCount(0);await expect(page.locator('.voice-description')).toContainText('Only teammates');await reachable(page.getByRole('button',{name:'Join voice chat',exact:true}));await contained(page,'.online-panel');
   await page.screenshot({path:`test-results/${info.project.name}-${size.width}-medieval-team-lobby.png`});await page.locator('.online-panel').evaluate(e=>e.scrollTop=0);await page.screenshot({path:`test-results/${info.project.name}-${size.width}-medieval-team-roster.png`});
  }
  await page.getByRole('button',{name:'Leave room',exact:true}).click();await expect(page.getByRole('button',{name:'Create room',exact:true})).toBeVisible();await reachable(page.getByRole('button',{name:'Close online lobby',exact:true}));await page.getByRole('button',{name:'Close online lobby',exact:true}).click();await expect(page.locator('.online-panel')).toHaveCount(0);
 }finally{await page.evaluate(()=>{for(const ws of (window as any).__lobbyGuests??[])ws.close();});}
});
