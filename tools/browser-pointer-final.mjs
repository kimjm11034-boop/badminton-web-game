const task=await taskSpace(2),page=task.page('p1');
await page.evaluate(()=>{document.querySelector('aside').scrollTop=9999;});await page.selectOption('#mode','match');
await page.waitForFunction(()=>window.shuttleLab.snapshot().phase==='service');
await page.evaluate(()=>{document.querySelector('aside').scrollTop=0;});
console.log(await page.evaluate(()=>({build:document.getElementById('build-note').textContent,phase:window.shuttleLab.snapshot().phase})));
