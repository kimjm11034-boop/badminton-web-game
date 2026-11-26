const entry=(await listTaskSpaces()).find(s=>s.id===2);
const task=entry?.ownership==='user'?await claimTaskSpace(2):await taskSpace(2);
const page=(await task.pages())[0]??await task.adopt((await task.tabs())[0].page);
await page.goto('https://www.youtube.com/watch?v=iqxuxEubedU');
console.log(await page.snapshot());
await page.waitForSelector('video');
await page.evaluate(()=>{const v=document.querySelector('video');v.muted=true;v.pause();v.currentTime=90;});
await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-step-reference90.png'}));
