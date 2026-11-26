import {createReadStream,readFileSync,writeFileSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {library,prepare,pose} from './strokes.mjs';
import {Vector3} from '../../vendor/three.module.js';
const home=new URL('../',import.meta.url),src=new URL('../../motion-lab/catalog/',import.meta.url),cache=new URL('../../.cache/court-studio/',import.meta.url);
const read=n=>JSON.parse(readFileSync(new URL(n+'.json',src))),v=a=>new Vector3(...a),dir=(a,b)=>b.clone().sub(a).normalize();
const groups=read('manifest').groups,targets={},best={};
for(const c of library){if(!c.code||targets[c.code])continue;prepare(c);const j=pose(c,c.contact).j;targets[c.code]={c,ua:dir(j.shoulderR,j.elbowR),fa:dir(j.elbowR,j.wristR)};}
let keys;
const input=createReadStream(new URL('motion-library.jsonl.gz',src)).pipe(createGunzip());
for await(const line of createInterface({input,crlfDelay:Infinity})){
 const row=JSON.parse(line);if(row.type==='schema'){keys=row.joints;continue;}
 if(row.type!=='track'||row.frames.length<2)continue;
 const frames=row.frames.map(f=>Object.fromEntries(keys.map((k,i)=>[k,v(f.joints[i])]))),target=targets[row.code];
 let impact=0,error=Infinity,travel=0;
 for(const [i,j] of frames.entries()){
  const cost=target?2-dir(j.shoulderR,j.elbowR).dot(target.ua)-dir(j.elbowR,j.wristR).dot(target.fa):0;
  if(cost<error){error=cost;impact=i;}
  if(i)travel+=j.wristR.distanceTo(frames[i-1].wristR);
 }
 const span=Math.max(...row.frames.map(f=>Math.max(...f.input2D.map(p=>p[1]))-Math.min(...f.input2D.map(p=>p[1]))));
 const score=-error+.42*Math.min(row.frames.length,5)+.48*Math.min(travel,1.8)+.3*Math.min(span/250,1)+.15*row.frames.filter(f=>f.method==='label').length;
 if(!best[row.code]||score>best[row.code].score)best[row.code]={row,impact,score};
}
const clips=[],images={};
for(const [code,{row,impact}] of Object.entries(best)){
 const index=read(code+'-'+row.camera+'-index').findIndex(a=>a[0]===row.id);
 const raw=read(code+'-'+row.camera+'-'+Math.floor(index/48))[index%48];
 const ref=targets[code]?.c,duration=ref?.seconds||1.5,first=row.frames[0].index,last=row.frames.at(-1).index;
 const frameTimes=row.frames.map(f=>(f.index-first)/(last-first));const id='sequence-'+code.toLowerCase(),group=groups.find(g=>g.code===code);
 const fr=row.frames.map(f=>Object.fromEntries(keys.map((k,i)=>[k,f.joints[i]])));
 // Preserve original observation instants. Piecewise smoothstep within each sparse interval.
 const count=Math.max(3,Math.round(duration*60)+1),dense=[];
 for(let i=0;i<count;i++){
  const t=i/(count-1);let n=0;while(n<fr.length-2&&t>frameTimes[n+1])n++;
  const u=(t-frameTimes[n])/(frameTimes[n+1]-frameTimes[n]),w=u*u*(3-2*u);
  dense.push(Object.fromEntries(keys.map(k=>[k,fr[n][k].map((a,j)=>(a+(fr[n+1][k][j]-a)*w)*1.06)])));
 }
 images[id]=raw.frames.map((f,i)=>({at:frameTimes[i],index:f.index,image:f.image,member:f.member}));
 clips.push({id,name:group.name+' · 연속 사진',en:ref?.en||code,family:ref?.family||'기타',kind:'sequence',contact:ref?frameTimes[impact]:null,times:Array.from({length:count},(_,i)=>duration*i/(count-1)),frames:dense,
  reference:{code,camera:row.camera,track:row.id,member:raw.frames[impact].member,observations:fr.length,at:frameTimes,description:group.name+' · '+row.camera+' · 같은 선수의 원본 '+fr.length+'장'}});
}
writeFileSync(new URL('photo.json',cache),JSON.stringify(clips));writeFileSync(new URL('reference-frames.json',home),JSON.stringify(images));console.log(clips.length,'sequences;',clips.reduce((s,c)=>s+c.reference.observations,0),'observed poses');
