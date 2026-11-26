const task=await taskSpace(2),page=task.page('p1');
// 서비스 홀짝 배치를 실제 서브 대기 상태에서 확인합니다.
await page.waitForFunction(()=>{const s=window.shuttleLab.snapshot();return s.phase==='service'&&s.serverIndex===1&&s.score[1]%2===1;},undefined,{timeout:15000});
console.log({oddService:await page.evaluate(()=>window.shuttleLab.snapshot().service)});
const rect=await page.evaluate(()=>document.getElementById('court').getBoundingClientRect().toJSON());
await page.waitForFunction(()=>{const s=window.shuttleLab.snapshot();return s.phase==='playing'&&s.lastHit===1&&s.ball.z>5&&s.ball.vz<0;},undefined,{timeout:6000});
await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.45);
await page.mouse.down();
await page.waitForFunction(()=>{const s=window.shuttleLab.snapshot();return s.ball.z<3.9&&s.ball.vz<0;},undefined,{timeout:3000});
await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.45+100);
await page.mouse.up();
await page.waitForFunction(()=>window.shuttleLab.snapshot().lastHit===0,undefined,{timeout:2000});
console.log(await page.evaluate(()=>({s:window.shuttleLab.snapshot(),feedback:document.getElementById('last-feedback').textContent})));
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-v3-jump2.png'}));
