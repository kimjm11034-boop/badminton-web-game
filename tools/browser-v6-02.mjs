const task=await taskSpace(2),page=task.page('p1');
// 에이전트의 검증 탭에 상대 서브 0:0 테스트 픽스처를 구성합니다.
await page.evaluate(()=>{const s=JSON.parse(sessionStorage.getItem('shuttle-session'));s.score=[0,0];s.serverIndex=1;s.active=true;s.paused=false;s.settings.mode='match';s.settings.difficulty='hard';sessionStorage.setItem('shuttle-session',JSON.stringify(s));});await page.reload();
await page.waitForFunction(()=>{const s=window.shuttleLab?.snapshot();return s?.phase==='playing'&&s.players[0].contactAt-s.simTime<.4&&s.players[0].contactAt-s.simTime>.25;},undefined,{timeout:8000});
const r=await page.evaluate(()=>document.getElementById('court').getBoundingClientRect().toJSON());await page.mouse.move(r.x+r.width*.5,r.y+r.height*.6);await page.mouse.down();
await page.waitForFunction(()=>{const s=window.shuttleLab.snapshot();return s.simTime-s.players[0].contactAt>.205;},undefined,{timeout:2500});await page.mouse.up();
await page.waitForFunction(()=>window.shuttleLab.snapshot().score[1]===1,undefined,{timeout:1500});
console.log(await page.evaluate(()=>({score:window.shuttleLab.snapshot().score,phase:window.shuttleLab.snapshot().phase,verdict:document.getElementById('timing-verdict').textContent,feedback:document.getElementById('last-feedback').textContent})));
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-v6-late.png'}));
await page.waitForFunction(()=>{const s=window.shuttleLab.snapshot();return s.phase==='playing'&&s.players[0].contactAt-s.simTime<.3&&s.players[0].contactAt-s.simTime>.2;},undefined,{timeout:8000});
await page.mouse.down();await page.waitForFunction(()=>{const s=window.shuttleLab.snapshot();return s.simTime-s.players[0].contactAt>-.02;},undefined,{timeout:1500});await page.mouse.up();
console.log(await page.evaluate(()=>({verdict:document.getElementById('timing-verdict').textContent,feedback:document.getElementById('last-feedback').textContent,phase:window.shuttleLab.snapshot().phase})));
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-v6-contact.png'}));
