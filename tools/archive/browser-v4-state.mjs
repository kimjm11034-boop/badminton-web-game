const task=await taskSpace(2),page=task.page('p1');
console.log(await page.evaluate(()=>({s:window.shuttleLab.snapshot(),hidden:document.hidden,focus:document.hasFocus(),rect:document.getElementById('court').getBoundingClientRect().toJSON(),active:document.activeElement.outerHTML.slice(0,300)})));
await page.mouse.up();
