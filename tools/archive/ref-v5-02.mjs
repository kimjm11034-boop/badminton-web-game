const task=await taskSpace(2),page=task.page('p1'),fs=await import('node:fs/promises');
const dir='C:/Users/Owner/orca/projects/배드민턴 웹 게임 개발/.cache/pose';await fs.mkdir(dir,{recursive:true});const frames=[];
for(const time of [90,91,92,93,94,95,96,97,98,99,100,101]){
 await page.evaluate(t=>{const v=document.querySelector('video');v.pause();v.currentTime=t;},time);
 await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.seeking&&v.readyState>=2;});
 const rect=await page.evaluate(()=>document.querySelector('video').getBoundingClientRect().toJSON());
 const path=await page.screenshot({path:dir+'/frame-'+time+'.png'});frames.push({time,path,rect});
}
await fs.writeFile(dir+'/manifest.json',JSON.stringify(frames));console.log({frames:frames.length,dir});
