const task=await taskSpace(2),page=task.page('p1');
console.log(await page.evaluate(()=>({s:window.shuttleLab.snapshot(),hold:document.getElementById('hold').textContent,gesture:document.getElementById('gesture-state').textContent})));
await page.mouse.up();
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-v4-debug.png'}));
