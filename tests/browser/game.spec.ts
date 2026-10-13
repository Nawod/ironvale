import {test,expect} from '@playwright/test';
test('starts a match, recruits villagers, saves and resumes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Begin your reign'}).click();
 await expect(page.getByTestId('battlefield')).toBeVisible();await expect(page.getByTestId('population')).toContainText('7 / 15');
 await page.getByRole('button',{name:'Town center',exact:true}).click();await page.getByRole('button',{name:'Recruit Villager',exact:true}).click();
 await expect(page.getByText('Training Villager')).toBeVisible();
 await page.getByRole('button',{name:'Save match',exact:true}).click();await expect(page.getByRole('status')).toContainText('Match saved');
 await page.getByRole('button',{name:'Pause match',exact:true}).click();await expect(page.getByRole('heading',{name:'The realm can wait'})).toBeVisible();await page.getByRole('button',{name:'Resume match',exact:true}).click();
 await page.screenshot({path:`test-results/${test.info().project.name}-battlefield.png`});expect(errors).toEqual([]);
});
test('four empires and tutorial remain usable at the device viewport',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Three rivals'}).click();await page.getByRole('button',{name:'Learn as you play'}).click();await page.getByRole('button',{name:'Begin your reign'}).click();await expect(page.getByTestId('empire-count')).toContainText('4');await expect(page.getByText('A home for your people',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Idle villagers'})).toBeVisible();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);expect(overflow).toBe(false);});
