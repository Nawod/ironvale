import {expect,test,type Locator,type Page} from '@playwright/test';
import {closeRealmStatus,openCommands,openGameMenu,openRealmStatus} from './hud-helpers';

async function readableControl(control:Locator,minimum=14){
 await expect(control).toBeVisible();
 const size=await control.evaluate(element=>{const rect=element.getBoundingClientRect();return{font:parseFloat(getComputedStyle(element).fontSize),width:rect.width,height:rect.height};});
 expect(size.font).toBeGreaterThanOrEqual(minimum);
 expect(size.height).toBeGreaterThanOrEqual(44);
 expect(size.width).toBeGreaterThanOrEqual(44);
 await control.scrollIntoViewIfNeeded();
 expect(await control.evaluate(element=>{const rect=element.getBoundingClientRect();const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return !!hit&&element.contains(hit);})).toBe(true);
}

async function contained(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const overflow=await page.locator('.hud,.realm-strip,.command-deck,.camera-controls').evaluateAll(elements=>elements.filter(element=>{if(!element.getClientRects().length||getComputedStyle(element).visibility==='hidden')return false;const rect=element.getBoundingClientRect();return rect.left<0||rect.right>innerWidth+1||rect.bottom>innerHeight+1;} ).map(element=>element.className));
 expect(overflow).toEqual([]);
}

async function contrast(text:Locator,background:Locator){
 const [foreground,backdrop]=await Promise.all([text.evaluate(element=>getComputedStyle(element).color),background.evaluate(element=>getComputedStyle(element).backgroundColor)]);
 const luminance=(color:string)=>{const rgb=color.match(/[\d.]+/g)!.slice(0,3).map(value=>{const channel=Number(value)/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 const values=[luminance(foreground),luminance(backdrop)].sort((a,b)=>a-b);
 return(values[1]+.05)/(values[0]+.05);
}

test('campaign setup stays readable and preserves the chosen match options',async({page},info)=>{
 await page.goto('/');
 const minimum=info.project.name==='desktop'?16:14;
 await readableControl(page.getByRole('button',{name:'Begin your reign',exact:true}),minimum);
 await readableControl(page.getByRole('button',{name:'Play with Freinds',exact:true}),minimum);
 await expect(page.locator('.battlefield canvas')).toHaveAttribute('data-model-detail',/ready|fallback/);
 await page.screenshot({path:`test-results/${info.project.name}-readable-menu.png`});
 await readableControl(page.getByLabel('Computer rivals'),minimum);
 await readableControl(page.getByLabel('Difficulty',{exact:true}),minimum);
 await readableControl(page.getByLabel('Map seed',{exact:true}),minimum);
 await page.getByRole('button',{name:'Three rivals'}).click();
 await page.getByLabel('Difficulty',{exact:true}).selectOption('hard');
 await expect(page.locator('#difficulty-description')).toContainText('Faster decisions');
 await page.getByLabel('Map seed',{exact:true}).fill('A readable realm');
 await page.getByRole('button',{name:'Learn as you play'}).click();
 const vista=await page.locator('.menu-panel').evaluate(element=>{const rect=element.getBoundingClientRect();return innerWidth<700?rect.top:innerWidth-rect.right;});
 expect(vista).toBeGreaterThanOrEqual(140);
 await page.getByRole('button',{name:'Begin your reign',exact:true}).click();
 await openRealmStatus(page);
 await expect(page.getByTestId('empire-count')).toContainText('4 empires');
 await closeRealmStatus(page);await page.getByRole('button',{name:'Tutorial tip',exact:true}).click();
 await expect(page.getByText('A home for your people',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Hide tutorial tip',exact:true}).click();
 await contained(page);
});

test('resource ledger, world clock and production controls remain legible without covering each other',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Begin your reign',exact:true}).click();
 await expect(page.getByTestId('population')).toContainText('7 / 15');
 for(const total of await page.locator('.resource > span').all())expect(await total.evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
 expect(await contrast(page.locator('.resource.food > span'),page.locator('.hud'))).toBeGreaterThanOrEqual(4.5);
 await openRealmStatus(page);
 await expect(page.getByTestId('world-weather')).toContainText('Day 1');
 expect(await page.getByTestId('world-weather').evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
 await closeRealmStatus(page);
 for(const name of ['Idle villagers','Select all army','Realm status','Camera tools','Pause match'])await readableControl(page.getByRole('button',{name,exact:true}),14);
 const separated=await page.evaluate(()=>{const ledger=document.querySelector('.hud')!.getBoundingClientRect(),camera=document.querySelector('.camera-controls')!.getBoundingClientRect(),deck=document.querySelector('.command-deck')!.getBoundingClientRect();return{cameraBelow:camera.top>=ledger.bottom,fieldHeight:deck.top-ledger.bottom};});
 expect(separated.cameraBelow).toBe(true);expect(separated.fieldHeight).toBeGreaterThan(page.viewportSize()!.height*.5);
 await page.getByRole('button',{name:'Town center',exact:true}).click();
 await openCommands(page,'Train');
 const recruit=page.getByRole('button',{name:'Recruit Villager',exact:true});await readableControl(recruit,info.project.name==='desktop'?16:14);
 expect(await recruit.locator('.cost').evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
 expect(await contrast(recruit.locator('.cost'),recruit)).toBeGreaterThanOrEqual(4.5);
 await expect(recruit.locator('.duration')).toHaveText('10s training');
 await recruit.click();await expect(page.getByText('Training Villager',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Idle villagers',exact:true}).click();
 await openCommands(page,'Build');
 const house=page.getByRole('button',{name:'Build House',exact:true});await house.scrollIntoViewIfNeeded();await readableControl(house,14);await expect(house.locator('.duration')).toHaveText('12s construction');await house.click();
 await expect(page.locator('.order-banner')).toContainText('Place House');
 const instruction=await page.locator('.order-banner').boundingBox();
 expect(await page.evaluate(point=>document.elementFromPoint(point.x,point.y)?.tagName,{x:instruction!.x+30,y:instruction!.y+instruction!.height/2})).toBe('CANVAS');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await contained(page);await page.screenshot({path:`test-results/${info.project.name}-readable-command-deck.png`});
});

test('interface text preference and online entry remain usable',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Play with Freinds',exact:true}).click();
 await expect(page.getByLabel('Online multiplayer')).toBeVisible();await readableControl(page.getByRole('button',{name:'Create room',exact:true}),14);
 await page.getByRole('button',{name:'Close online lobby',exact:true}).click();await page.getByRole('button',{name:'Begin your reign',exact:true}).click();
 const menu=await openGameMenu(page);await menu.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Interface text size',{exact:true}).selectOption('large');
 await page.getByRole('button',{name:'Return to your empire',exact:true}).click();
 await expect(page.locator('main')).toHaveAttribute('data-interface-size','large');await page.getByRole('button',{name:'Town center',exact:true}).click();
 await openCommands(page,'Train');
 expect(await page.getByRole('button',{name:'Recruit Villager',exact:true}).evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(18);
 await contained(page);await page.reload();await expect(page.locator('main')).toHaveAttribute('data-interface-size','large');
 if(info.project.name==='phone'){
  await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'Begin your reign',exact:true}).click();await page.getByRole('button',{name:'Idle villagers',exact:true}).click();
  await openCommands(page,'Build');
  const house=page.getByRole('button',{name:'Build House',exact:true});await house.scrollIntoViewIfNeeded();await readableControl(house,14);await contained(page);
  await page.screenshot({path:'test-results/phone-landscape-readable-command-deck.png'});
 }
});
