import {expect,type Page} from '@playwright/test';

export async function openCommands(page:Page,tab:'Orders'|'Build'|'Tasks'|'Train'|'Improve'|'Manage'){
 if(await page.locator('main').getAttribute('data-hud-compact')==='true'){
  if(await page.getByRole('button',{name:'Open commands',exact:true}).isVisible())await page.getByRole('button',{name:'Open commands',exact:true}).click();
 }else if(await page.getByRole('button',{name:'Expand commands',exact:true}).isVisible())await page.getByRole('button',{name:'Expand commands',exact:true}).click();
 const actionTab=page.getByRole('tab',{name:tab==='Tasks'?/^Tasks(?: \(\d+\))?$/:tab,exact:tab!=='Tasks'});
 await actionTab.click();await expect(actionTab).toHaveAttribute('aria-selected','true');
}

export async function openRealmStatus(page:Page){
 if(await page.locator('main').getAttribute('data-hud-compact')==='true'&&!await page.getByTestId('world-weather').isVisible())await page.getByRole('button',{name:'Realm status',exact:true}).click();
 await expect(page.getByTestId('world-weather')).toBeVisible();
}

export async function closeRealmStatus(page:Page){
 if(await page.getByRole('button',{name:'Close realm status',exact:true}).isVisible())await page.getByRole('button',{name:'Close realm status',exact:true}).click();
}

export async function openGameMenu(page:Page){
 const menu=page.getByRole('dialog',{name:'Game menu',exact:true});
 if(!await menu.isVisible())await page.getByRole('button',{name:'Pause match',exact:true}).click();
 await expect(menu).toBeVisible();return menu;
}

export async function saveMatch(page:Page){
 const menu=await openGameMenu(page);await menu.getByRole('button',{name:'Save match',exact:true}).click();
 await expect(page.getByText('Match saved in this browser.',{exact:true})).toBeVisible();
 await menu.getByRole('button',{name:'Resume match',exact:true}).click();await expect(menu).toHaveCount(0);
}
