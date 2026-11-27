const entry=(await listTaskSpaces()).find(s=>s.id===2);
const task=entry?.ownership==='user'?await claimTaskSpace(2):await taskSpace(2);
const page=(await task.pages())[0]??await task.adopt((await task.tabs())[0].page);
await page.goto('https://www.youtube.com/watch?v=7Cq6jc-8QzQ');
console.log(await page.snapshot());
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-ref-video.png'}));
await page.goto('https://manus.im/share/RX638KgwUT9bNDlMoquR3C');
console.log(await page.snapshot());
