const task=await taskSpace(2),page=task.page('p1');
await page.evaluate(()=>{window.pauseEvents=[];document.addEventListener('visibilitychange',()=>pauseEvents.push({type:'visibility',hidden:document.hidden,t:performance.now()}));document.addEventListener('keydown',e=>pauseEvents.push({type:'key',code:e.code}));document.getElementById('pause').addEventListener('click',()=>pauseEvents.push({type:'pauseClick'}));});
await page.click('#pause');
console.log({afterResume:await page.evaluate(()=>({p:window.shuttleLab.snapshot().paused,events:window.pauseEvents}))});
await page.mouse.move(530,350);await page.mouse.down();
console.log({afterDown:await page.evaluate(()=>({p:window.shuttleLab.snapshot().paused,events:window.pauseEvents}))});
await page.mouse.up();
