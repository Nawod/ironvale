import { chromium, devices } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const html = execFileSync('python',['-c', 'import sys;from zipfile import ZipFile;z=ZipFile(sys.argv[1]);assert z.namelist()==[\"index.html\"];assert z.testzip() is None;sys.stdout.buffer.write(z.read(\"index.html\"))',fileURLToPath(new URL('../releases/kingdom-lanka-itch.zip',import.meta.url))]);
assert.match(html.toString(), /https:\/\/ironvale\.onrender\.com\//);
const listen = (handler) => new Promise(resolve => { const s=createServer(handler);s.listen(0,'127.0.0.1',()=>resolve(s)); });
const build = await listen((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});
const launcher = `http://127.0.0.1:${build.address().port}/index.html`;
const outer = await listen((req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<iframe title="itch.io embed emulation" src="${launcher}" allow="fullscreen; autoplay; microphone; gamepad" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><style>body{margin:0}</style>`);});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle',`--use-angle=${process.platform==='win32'?'d3d11':'default'}`,'--enable-webgl','--ignore-gpu-blocklist']});
const reports=[];
try {
 await mkdir('docs/itch-evidence',{recursive:true});
 for (const [name,use] of [['desktop',{viewport:{width:1440,height:900}}],['phone',{...devices['iPhone 13'],viewport:{width:844,height:390},defaultBrowserType:undefined}]]) {
  const context=await browser.newContext(use);const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${outer.address().port}`);
  const host=page.frameLocator('iframe'), game=host.frameLocator('iframe[title="Kingdom Lanka game"]');
  await game.getByRole('button',{name:'Begin your reign',exact:true}).waitFor({timeout:90000});
  const frame=page.frames().find(f=>f.url().startsWith('https://ironvale.onrender.com/'));assert.ok(frame);
  const welcome=await frame.evaluate(()=>new Promise((resolve,reject)=>{
   const socket=new WebSocket('wss://ironvale.onrender.com/ws');const timeout=setTimeout(()=>{socket.close();reject(new Error('WebSocket welcome timeout'));},15000);
   socket.onmessage=event=>{const data=JSON.parse(event.data);clearTimeout(timeout);socket.close();resolve({type:data.type,protocol:data.protocol,origin:location.origin});};
   socket.onerror=()=>{clearTimeout(timeout);reject(new Error('Embedded multiplayer connection failed'));};
  }));
  assert.equal(welcome.type,'welcome');assert.equal(welcome.protocol,1);assert.equal(welcome.origin,'https://ironvale.onrender.com');
  await page.screenshot({path:`docs/itch-evidence/${name}-menu.png`});
  await game.getByRole('button',{name:'Begin your reign',exact:true}).click();
  await game.locator('[data-testid="battlefield"] canvas').first().waitFor({timeout:60000});
  await game.getByRole('button',{name:'Town center',exact:true}).waitFor({timeout:60000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:`docs/itch-evidence/${name}-playing.png`});
  reports.push({name,nestedCrossOriginFrames:true,menu:true,startedSinglePlayer:true,multiplayerWelcome:welcome,physicalDevice:false});
  await context.close();
 }
 await writeFile('docs/itch-evidence/verification.json',JSON.stringify({testedAt:new Date().toISOString(),render:'https://ironvale.onrender.com/',actualItchUpload:false,source:'verified ZIP index.html',reports},null,2));
 console.log(JSON.stringify(reports,null,2));
} finally {await browser.close();await Promise.all([new Promise(r=>build.close(r)),new Promise(r=>outer.close(r))]);}
