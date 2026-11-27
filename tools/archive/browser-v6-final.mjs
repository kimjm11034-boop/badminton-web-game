const task=await taskSpace(2),page=task.page('p1');
await page.evaluate(()=>{document.querySelector('aside').scrollTop=9999;});await page.click('#restart');
await page.waitForFunction(()=>window.shuttleLab.snapshot().phase==='service');
await page.evaluate(()=>{document.querySelector('aside').scrollTop=0;});
console.log(await page.evaluate(()=>({build:document.getElementById('build-note').textContent,mode:document.getElementById('mode').value,difficulty:document.getElementById('difficulty').value,score:window.shuttleLab.snapshot().score,phase:window.shuttleLab.snapshot().phase,title:document.getElementById('shot-title').textContent})));
