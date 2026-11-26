const task=await taskSpace(2),page=task.page('p1');
await page.selectOption('loc=css:#mode','practice');
const rect=await page.evaluate(()=>document.getElementById('court').getBoundingClientRect().toJSON());
const results=[];
for(let i=0;i<4;i++){
  await page.waitForFunction(()=>{const s=window.shuttleLab.snapshot();return s.phase==='playing'&&s.lastHit===1&&s.ball.y<-.8&&s.ball.z>3&&s.ball.vz<0;},undefined,{timeout:10000});
  await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.7);
  await page.mouse.down();
  const started=Date.now();
  await page.waitForFunction(t=>Date.now()-t>270,started,{timeout:1500});
  await page.mouse.move(rect.x+rect.width*.5+5,rect.y+rect.height*.7-55);
  await page.mouse.up();
  await page.waitForFunction(()=>{const s=window.shuttleLab.snapshot();return s.lastHit===0||s.phase!=='playing';},undefined,{timeout:2000});
  results.push(await page.evaluate(()=>({s:window.shuttleLab.snapshot(),shot:document.getElementById('last-feedback').textContent})));
  await page.waitForFunction(()=>{const s=window.shuttleLab.snapshot();return s.lastHit===1||s.phase!=='playing';},undefined,{timeout:7000});
}
console.log(results);
await page.click('loc=css:#pause');
const before=await page.evaluate(()=>window.shuttleLab.snapshot());
console.log({paused:before.paused});
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-rally.png'}));
