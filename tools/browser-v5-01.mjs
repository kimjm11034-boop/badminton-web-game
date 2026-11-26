const task=await taskSpace(2),page=task.page('p1');
await page.goto('http://localhost:5173');
await page.waitForFunction(()=>!!window.shuttleLab,undefined,{timeout:10000});
await page.evaluate(()=>{document.querySelector('aside').scrollTop=9999;});await page.click('#restart');
await page.waitForFunction(()=>window.shuttleLab.snapshot().phase==='service');
await page.evaluate(()=>{document.querySelector('aside').scrollTop=0;});
console.log(await page.evaluate(()=>({s:window.shuttleLab.snapshot(),webgl:document.querySelector('.webgl-court')?.width})));
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-v5-3d.png'}));
