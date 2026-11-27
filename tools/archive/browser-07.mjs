const task=await taskSpace(2),page=task.page('p1');
console.log(await page.evaluate(()=>({build:document.getElementById('build-note').textContent,live:document.getElementById('live-status').textContent,phase:window.shuttleLab.snapshot().phase})));
const mobile=await task.newPage();
await mobile.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await mobile.goto('http://localhost:5173');
console.log(await mobile.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,canvas:document.getElementById('court').getBoundingClientRect().toJSON()})));
console.log(await mobile.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-mobile.png'}));
