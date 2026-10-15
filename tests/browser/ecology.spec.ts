import {test,expect} from '@playwright/test';
import {openCommands} from './hud-helpers';

test('villagers gather fruit bushes into the food stock through map commands',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Begin your reign',exact:true}).click();
 await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','ready',{timeout:30000});
 await page.getByRole('button',{name:'Idle villagers',exact:true}).click();await openCommands(page,'Orders');await page.getByRole('button',{name:'Gather',exact:true}).click();
 const viewport=page.viewportSize()!,zoom=viewport.width<600?.92:1.1;
 // Selecting idle villagers centers the first worker at (17,22); bushes are rooted at (14,20).
 const point={x:viewport.width/2+((14-20)*32+160)*zoom,y:viewport.height*(viewport.width<700?.44:.42)+((14+20)*16-624)*zoom-10*zoom};
 expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName,point)).toBe('CANVAS');
 if(info.project.name==='desktop')await page.mouse.click(point.x,point.y);else await page.touchscreen.tap(point.x,point.y);
 await expect(page.locator('.order-banner')).toHaveCount(0);
 await expect.poll(async()=>Number(await page.locator('.resource.food > span').textContent()),{timeout:30000}).toBeGreaterThan(350);
 await page.screenshot({path:`test-results/${info.project.name}-fruit-harvest.png`});
});

test('missing detailed assets leave a playable battlefield with an explicit fallback',async({page})=>{
 await page.route('**/models/*.glb',route=>route.abort());
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.getByRole('button',{name:'Begin your reign',exact:true}).click();
 await expect(page.locator('[data-testid="battlefield"] canvas')).toHaveAttribute('data-model-detail','fallback',{timeout:30000});
 await expect(page.locator('.asset-loading-status')).toContainText('Basic models are active');
 await page.getByRole('button',{name:'Town center',exact:true}).click();await openCommands(page,'Train');await page.getByRole('button',{name:'Recruit Villager',exact:true}).click();
 await expect(page.locator('.resource.food > span')).toHaveText('300');await expect(page.getByText('Training Villager',{exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});

test('missing optional foliage texture preserves realm scenery and detailed actors',async({page})=>{
 await page.route('**/models/materials/twig_alpha.png',route=>route.abort());
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.getByRole('button',{name:'Begin your reign',exact:true}).click();
 const canvas=page.locator('[data-testid="battlefield"] canvas');await expect(canvas).toHaveAttribute('data-model-detail','ready',{timeout:30000});await expect(canvas).toHaveAttribute('data-texture-detail','fallback');
 await expect(page.locator('.asset-loading-status')).toContainText('Detailed realm models are active');await page.getByRole('button',{name:'Idle villagers',exact:true}).click();await expect(page.locator('.selection-panel')).toContainText('6 units');expect(errors).toEqual([]);
});

test('unavailable realm assets retain playable scenery without losing army models',async({page})=>{
 await page.route('**/models/realm/*.glb',route=>route.abort());const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.getByRole('button',{name:'Begin your reign',exact:true}).click();const canvas=page.locator('[data-testid="battlefield"] canvas');
 await expect(canvas).toHaveAttribute('data-scenery-detail','fallback',{timeout:7000});await expect(canvas).toHaveAttribute('data-model-detail','ready',{timeout:30000});await expect(page.locator('.asset-loading-status')).toContainText('Original buildings and scenery are active');
 await page.getByRole('button',{name:'Town center',exact:true}).click();await openCommands(page,'Train');await page.getByRole('button',{name:'Recruit Villager',exact:true}).click();await expect(page.locator('.resource.food > span')).toHaveText('300');expect(errors).toEqual([]);
});
