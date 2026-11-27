const task=await taskSpace(2),page=task.page('p1');
await page.evaluate(()=>{document.querySelector('aside').scrollTop=9999;});
await page.selectOption('#mode','match');
await page.waitForFunction(()=>window.shuttleLab.snapshot().phase==='service');
await page.evaluate(()=>{document.querySelector('aside').scrollTop=0;});
console.log(await page.evaluate(()=>({build:document.getElementById('build-note').textContent,live:document.getElementById('live-status').textContent,state:window.shuttleLab.snapshot()})));
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-v3-ready.png'}));
