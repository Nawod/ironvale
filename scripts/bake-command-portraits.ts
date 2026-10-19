import {spawn} from 'node:child_process';
import {mkdir,writeFile,readdir,stat} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const port=5193,out='public/art/portraits',preview=process.argv.includes('--preview'),historicalOnly=process.argv.includes('--historical');await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{windowsHide:true,stdio:'pipe'});let startup='';server.stderr.on('data',data=>startup+=data);let browser;
try{
 let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw new Error(`Portrait server exited: ${startup}`);try{ready=(await fetch(`http://127.0.0.1:${port}/scripts/portrait-bake.html`)).ok;}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,200));}if(!ready)throw new Error('Portrait workshop did not start.');
 browser=await chromium.launch({args:['--use-gl=angle',`--use-angle=${process.platform==='win32'?'d3d11':'default'}`,'--enable-webgl','--ignore-gpu-blocklist']});const page=await browser.newPage({viewport:{width:256,height:256}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 let count=0;await page.exposeFunction('savePortrait',async(name:string,data:string)=>{if(!/^[a-zA-Z0-9-]+\.webp$/.test(name)||!data.startsWith('data:image/webp;base64,'))throw new Error('Unexpected portrait output.');await writeFile(`${out}/${name}`,Buffer.from(data.split(',')[1],'base64'));if(++count%64===0)console.log(`Rendered ${count} portraits`);});
 await page.goto(`http://127.0.0.1:${port}/scripts/portrait-bake.html`);const result=await page.evaluate(async({preview,historicalOnly})=>{const baker=await import('/src/render/portrait-baker.ts' as string);return baker.bakeCommandPortraits((window as any).savePortrait,preview,historicalOnly);},{preview,historicalOnly});
 if(errors.length)throw new Error(errors.join('\n'));let bytes=0;for(const file of await readdir(out))if(file.endsWith('.webp'))bytes+=(await stat(`${out}/${file}`)).size;
 const report={...result,preview,historicalOnly,bytes,source:'Ironvale game model providers; generated locally',generatedAt:new Date().toISOString()};await writeFile(`${out}/${historicalOnly?'historical-manifest':'manifest'}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser?.close();server.kill();}
