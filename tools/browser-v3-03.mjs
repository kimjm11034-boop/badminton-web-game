const task=await taskSpace(2),page=task.page('p1');
const rect=await page.evaluate(()=>document.getElementById('court').getBoundingClientRect().toJSON());
await page.mouse.click(rect.x+rect.width*.55,rect.y+rect.height*.65);
await page.waitForFunction(()=>window.shuttleLab.snapshot().phase==='playing');
await page.waitForFunction(()=>{const s=window.shuttleLab.snapshot();return s.lastHit===1&&s.rally>0||s.phase==='waiting';},undefined,{timeout:7000});
console.log(await page.evaluate(()=>window.shuttleLab.snapshot()));
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-v3-service.png'}));
