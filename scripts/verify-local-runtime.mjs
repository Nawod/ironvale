import {chromium,expect} from '@playwright/test';
import {WebSocket} from 'ws';
import {writeFile,mkdir} from 'node:fs/promises';

const base=process.env.IRONVALE_VERIFY_URL??'http://127.0.0.1:8180';
const health=await (await fetch(`${base}/health`)).json();
if(!health.ok)throw new Error('Game server is not ready');
const assets=[];
for(const [path,type]of [['/models/deer.glb','model/gltf-binary'],['/models/materials/twig_alpha.png','image/png'],['/models/materials/bark_diff.jpg','image/jpeg']]){
 const response=await fetch(base+path,{method:'HEAD'});
 if(!response.ok||response.headers.get('content-type')!==type||response.headers.get('cache-control')!=='no-cache')throw new Error(`Incorrect asset response: ${path}`);
 assets.push({path,type,cache:response.headers.get('cache-control')});
}
const welcome=await new Promise((resolve,reject)=>{
 const socket=new WebSocket(base.replace(/^http/,'ws')+'/ws'),timer=setTimeout(()=>{socket.terminate();reject(new Error('Multiplayer welcome timed out'));},8000);
 socket.once('error',error=>{clearTimeout(timer);reject(error);});socket.once('message',data=>{clearTimeout(timer);socket.close();resolve(JSON.parse(data.toString()));});
});
if(welcome.type!=='welcome')throw new Error('Multiplayer did not send a welcome');
const browser=await chromium.launch({headless:true,args:['--use-gl=angle',`--use-angle=${process.platform==='win32'?'d3d11':'default'}`,'--enable-webgl','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await page.getByRole('button',{name:'Begin your reign',exact:true}).click();
 const canvas=page.locator('[data-testid="battlefield"] canvas');await canvas.waitFor();
 await page.waitForFunction(()=>{const canvas=document.querySelector('[data-testid="battlefield"] canvas');return canvas?.dataset.modelDetail==='ready'&&canvas.dataset.textureDetail==='ready';},{},{timeout:30000});
 await page.getByRole('button',{name:'Town center',exact:true}).click();await page.getByRole('button',{name:'Recruit Villager',exact:true}).click();
 await expect(page.locator('.resource.food > span')).toHaveText('300');
 if(errors.length)throw new Error(errors.join('\n'));
 await mkdir('docs/realm-evidence',{recursive:true});await page.screenshot({path:'docs/realm-evidence/local-runtime.png'});
 const report={url:base,health,assets,multiplayerWelcome:welcome.type,models:'ready',forestTextures:'ready',recruitmentFood:300,pageErrors:errors};
 await writeFile('docs/realm-evidence/local-runtime.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
