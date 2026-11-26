const task = await taskSpace('배드민턴 라이브 개발');
const page = task.page('p1');
console.log({ taskSpaceId: task.spaceId });
await page.goto('https://matdrive.app/');
console.log(await page.snapshot());
