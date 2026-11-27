const task = await taskSpace(2);
const page = task.page('p1');
await page.goto('https://www.instagram.com/reel/DeUSNthSV6T/');
console.log(await page.snapshot());
await page.goto('http://localhost:5173');
console.log(await page.snapshot());
console.log(await page.screenshot({path:'C:/Users/Owner/AppData/Local/Temp/shuttle-intro.png'}));
