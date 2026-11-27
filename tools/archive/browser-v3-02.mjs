const task=await taskSpace(2),page=task.page('p1');
console.log(await page.snapshot({scope:'full_page'}));
console.log(await page.evaluate(()=>({s:window.shuttleLab?.snapshot(),restart:document.getElementById('restart').getBoundingClientRect().toJSON()})));
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-v3-before.png'}));
