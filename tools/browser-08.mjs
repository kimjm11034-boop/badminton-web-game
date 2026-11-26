const task=await taskSpace(2),page=task.page('p1');
await page.evaluate(()=>{document.querySelector('aside').scrollTop=0;});
console.log(await page.evaluate(()=>({url:location.href,build:document.getElementById('build-note').textContent,live:document.getElementById('live-status').textContent,paused:window.shuttleLab.snapshot().paused,canvasReady:document.getElementById('court').width>0})));
