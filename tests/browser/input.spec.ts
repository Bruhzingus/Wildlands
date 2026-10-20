import {test,expect,type Page} from '@playwright/test';

const captured=async(page:Page)=>{
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect(page.locator('#overlay')).toBeHidden();
};

test('Space never activates focused controls and still jumps across upgrade popups',async({page})=>{
 await page.goto('/?dev=1');
 const starter=page.locator('[data-starter="25"]');
 await starter.focus();
 await page.keyboard.press('Space');
 await expect(starter).toBeFocused();
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.sim)).toBeNull();

 // Keep normal keyboard activation available for deliberately choosing a button.
 await page.keyboard.press('Enter');
 await captured(page);
 await page.evaluate(()=>{(window as any).__WILDLANDS__.sim.state.player.iframes=10000;});
 await page.keyboard.down('Space');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.y)).toBeGreaterThan(.1);

 // Reproduce a level-up taking focus while the jump key is already held.
 await page.keyboard.press('[');
 const cards=page.locator('.choice-card');
 await expect(cards).toHaveCount(3);
 await expect(cards.first()).toBeFocused();
 const choices=await cards.evaluateAll(elements=>elements.map(el=>(el as HTMLElement).dataset.choice));
 await page.keyboard.up('Space');
 await page.keyboard.press('Space');
 await page.keyboard.down('Space');
 await page.keyboard.down('Space'); // A repeated keydown while the popup is focused.
 await page.keyboard.up('Space');
 await expect(cards).toHaveCount(3);
 expect(await cards.evaluateAll(elements=>elements.map(el=>(el as HTMLElement).dataset.choice))).toEqual(choices);
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.phase)).toBe('choice');
 expect(await page.evaluate(()=>document.pointerLockElement)).toBeNull();

 await page.keyboard.press('1');
 await captured(page);
 await page.keyboard.press('Escape');
 const resume=page.locator('#resume-btn');
 await expect(resume).toBeFocused();
 await page.keyboard.press('Space');
 await expect(resume).toBeFocused();
 expect(await page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.phase)).toBe('paused');

 const checkbox=page.locator('#screen-shake');
 const checked=await checkbox.isChecked();
 await checkbox.focus();await page.keyboard.press('Space');
 expect(await checkbox.isChecked()).toBe(checked);
 const summary=page.locator('.build-summary summary');
 await summary.focus();await page.keyboard.press('Space');
 await expect(page.locator('.build-summary')).toHaveAttribute('open','');

 await resume.click();
 await captured(page);
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.y)).toBe(0);
 await page.keyboard.press('Space');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.sim.state.player.y)).toBeGreaterThan(.1);
});
