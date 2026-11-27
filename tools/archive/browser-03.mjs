const task=await taskSpace(2),page=task.page('p1');
await page.click('loc=css:#start');
await page.waitForFunction(()=>window.shuttleLab?.snapshot().phase==='playing');
console.log(await page.evaluate(()=>window.shuttleLab.snapshot()));
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-playing.png'}));
