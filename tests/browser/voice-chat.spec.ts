import {test,expect,type Page} from '@playwright/test';
test.use({permissions:['microphone'],launchOptions:{args:['--use-gl=angle','--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist','--use-fake-device-for-media','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']}});
async function observe(page:Page){await page.addInitScript(()=>{
 const root=window as any;root.__voiceStreams=[];root.__voiceConnections=[];const media=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await media(constraints);root.__voiceStreams.push(stream);return stream;};
 const Native=RTCPeerConnection;root.RTCPeerConnection=class extends Native{constructor(config?:RTCConfiguration){super({...config,iceServers:[]});root.__voiceConnections.push(this);}};
});}
async function enter(page:Page,name:string){await observe(page);await page.goto('/');await page.getByRole('button',{name:'Play with Freinds',exact:true}).click();await page.getByLabel('Your name').fill(name);}
async function energy(page:Page){return page.evaluate(async()=>{let total=0;for(const pc of (window as any).__voiceConnections as RTCPeerConnection[])if(pc.connectionState==='connected'){const stats=await pc.getStats();stats.forEach(r=>{if(r.type==='inbound-rtp'&&r.kind==='audio')total+=r.totalAudioEnergy??0;});}return total;});}
async function live(page:Page){return page.evaluate(()=>(window as any).__voiceConnections.filter((pc:RTCPeerConnection)=>pc.connectionState==='connected').length);}
async function joined(page:Page,count:number){await expect(page.locator('.voice-count')).toContainText(`${count} connected`,{timeout:25000});await expect.poll(()=>live(page)).toBe(count);}
test('real voice audio stays open or team-private, mutes, and survives the lobby-to-match transition',async({page,browser},info)=>{
 test.skip(info.project.name!=='desktop');test.setTimeout(180000);
 const contexts=await Promise.all([browser.newContext({permissions:['microphone'],viewport:{width:1100,height:850}}),browser.newContext({permissions:['microphone'],viewport:{width:1100,height:850}})]),b=await contexts[0].newPage(),c=await contexts[1].newPage();
 try{
  await enter(page,'Voice host');await page.getByRole('button',{name:'Create room',exact:true}).click();await page.getByLabel('Match type',{exact:true}).selectOption('teams');await page.getByRole('button',{name:'Open room',exact:true}).click();const code=await page.getByTestId('room-code').textContent();
  for(const [p,name]of [[b,'Voice ally'],[c,'Voice opponent']]as const){await enter(p,name);await p.getByRole('button',{name:'Join room',exact:true}).click();await p.getByLabel('Room code').fill(code!);await p.getByRole('button',{name:'Join friends',exact:true}).click();}
  await page.getByLabel('Team for Voice ally').selectOption('0');await page.getByLabel('Team for Voice opponent').selectOption('1');await expect(b.getByLabel('Team for Voice ally')).toHaveValue('0');
  for(const p of [page,b,c]){await p.getByRole('button',{name:'Join voice chat',exact:true}).click();await expect(p.getByRole('button',{name:'Unmute microphone',exact:true})).toBeEnabled({timeout:15000});expect(await p.evaluate(()=>(window as any).__voiceStreams.every((s:MediaStream)=>s.getAudioTracks().every(t=>!t.enabled)))).toBe(true);}
  for(const p of [page,b,c])await joined(p,2);
  await page.getByRole('button',{name:'Unmute microphone',exact:true}).click();await expect.poll(()=>energy(b),{timeout:15000}).toBeGreaterThan(0);await expect.poll(()=>energy(c),{timeout:15000}).toBeGreaterThan(0);
  await b.getByRole('button',{name:'Mute incoming voice',exact:true}).click();expect(await b.evaluate(()=>[...document.querySelectorAll('audio')].every(a=>a.muted))).toBe(true);await b.getByRole('button',{name:'Unmute incoming voice',exact:true}).click();
  await page.getByLabel('Voice channel').selectOption('team');await expect(page.getByRole('button',{name:'Unmute microphone',exact:true})).toBeEnabled();await joined(page,0);await joined(c,1);
  await b.getByLabel('Voice channel').selectOption('team');await joined(page,1);await joined(b,1);await joined(c,0);await expect(page.locator('.voice-peers')).toContainText('Voice ally');await expect(page.locator('.voice-peers')).not.toContainText('Voice opponent');
  await page.getByRole('button',{name:'Unmute microphone',exact:true}).click();await expect.poll(()=>energy(b),{timeout:15000}).toBeGreaterThan(0);await page.getByRole('button',{name:'Mute microphone',exact:true}).click();expect(await page.evaluate(()=>(window as any).__voiceStreams[0].getAudioTracks()[0].enabled)).toBe(false);
  await page.screenshot({path:'test-results/desktop-team-voice-lobby.png'});
  for(const p of [page,b,c])await p.getByRole('button',{name:'Ready',exact:true}).click();await page.getByRole('button',{name:'Start match',exact:true}).click();
  for(const p of [page,b]){await expect(p.locator('.voice-floating')).toBeVisible();await p.getByRole('button',{name:/Voice chat/}).click();await joined(p,1);expect(await p.evaluate(()=>(window as any).__voiceStreams.length)).toBe(1);}
  await page.getByRole('button',{name:'Pause match',exact:true}).click();await expect(page.getByRole('button',{name:'Resume match',exact:true})).toBeVisible();await page.screenshot({path:'test-results/desktop-voice-war-council.png'});
  await page.getByRole('button',{name:'Leave voice chat',exact:true}).click();expect(await page.evaluate(()=>(window as any).__voiceStreams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);await joined(b,0);
 }finally{await Promise.all(contexts.map(context=>context.close()));}
});
test('free-for-all exposes only open voice and leaves microphone capture stopped',async({page},info)=>{
 test.setTimeout(60000);await enter(page,'Voice FFA');await page.getByRole('button',{name:'Create room',exact:true}).click();await page.getByRole('button',{name:'Open room',exact:true}).click();await expect(page.getByLabel('Voice channel')).toHaveCount(0);await expect(page.locator('.voice-audience')).toHaveText('Open channel · everyone in this room');
 await page.getByRole('button',{name:'Join voice chat',exact:true}).click();await expect(page.getByRole('button',{name:'Unmute microphone',exact:true})).toBeEnabled({timeout:15000});await page.screenshot({path:`test-results/${info.project.name}-voice-controls.png`});await page.getByRole('button',{name:'Leave voice chat',exact:true}).click();expect(await page.evaluate(()=>(window as any).__voiceStreams[0].getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
});
