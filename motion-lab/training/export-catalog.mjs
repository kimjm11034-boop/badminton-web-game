import assert from 'node:assert/strict';
import {createWriteStream} from 'node:fs';
import {readFile,rename} from 'node:fs/promises';
import {createGzip} from 'node:zlib';
import {once} from 'node:events';
import {pipeline} from 'node:stream/promises';
import {prepareTrack,learnedPose,model} from '../learned-rig.js';

const dir=new URL('../catalog/',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name+'.json',dir),'utf8'));
const {stats,groups:codes}=await read('manifest'),{groups}=await read('patterns');
const assigned=new Map();
for(const group of groups){
  const members=await read(group.id+'-index');
  assert.equal(members.length,group.count);
  for(const record of members){
    const id=record[6];assert.ok(!assigned.has(id),id);assigned.set(id,group.id);
  }
}
const schema=['pelvis','chest','neck','head',...['L','R'].flatMap(s=>['shoulder','elbow','wrist','hand','hip','knee','ankle','heel','toe'].map(k=>k+s))];
const bonePairs=[['hip','knee','thigh'],['knee','ankle','shin'],['shoulder','elbow','upperArm'],['elbow','wrist','forearm']];
const rounded=v=>v.toArray().map(n=>Math.round(n*10000)/10000);
const imageErrors=[];
function projectedError(clip,pose,frame){
  const {angle,pitch}=clip.comparison,c=Math.cos(angle),s=Math.sin(angle),co=Math.cos(pitch),si=Math.sin(pitch);
  const xy=model.names.slice(0,12).map(k=>{
    const v=pose.j[k];return [c*v.x-s*v.z,-co*v.y+si*(s*v.x+c*v.z)];
  });
  const center=points=>points.reduce(([x,y],p)=>[x+p[0]/12,y+p[1]/12],[0,0]);
  const [mx,my]=center(xy),[u,v]=center(frame.input);
  let dot=0,magnitude=0;
  for(let i=0;i<12;i++){
    const [x,y]=xy[i],pt=frame.input[i];dot+=(x-mx)*(pt[0]-u)+(y-my)*(pt[1]-v);magnitude+=(x-mx)**2+(y-my)**2;
  }
  const scale=dot/Math.max(1e-8,magnitude),ys=frame.input.map(p=>p[1]),h=Math.max(...ys)-Math.min(...ys);
  return xy.reduce((error,[x,y],i)=>error+Math.hypot(u+scale*(x-mx)-frame.input[i][0],v+scale*(y-my)-frame.input[i][1]),0)/(12*Math.max(1,h));
}
const zip=createGzip({level:6});
const tmp=new URL('motion-library.jsonl.gz.tmp',dir);
const writing=pipeline(zip,createWriteStream(tmp));
async function line(data){
  if(!zip.write(JSON.stringify(data)+'\n'))await once(zip,'drain');
}
await line({type:'schema',version:1,units:'m',coordinateSystem:'athlete-local; +X anatomical right, +Y up, +Z backward',
  timing:'indices refer to supplied source JPGs; image spacing is not calibrated elapsed time',joints:schema,
  contact:'candidate from relative sole height; flight and ground reaction are unknown',
  root:'relative support-foot estimate; absolute court travel unknown',input2DOrder:model.names.slice(0,12),stats,
  patterns:groups.map(({id,name,family,fingerprint})=>({id,name,family,fingerprint}))});
const sources=new Set(),ids=new Set();let poses=0,missing=0;
const batches=codes.flatMap(g=>Object.entries(g.cameras).flatMap(([cam,c])=>
  Array.from({length:Math.ceil((c.tracks+c.missing)/48)},(_,i)=>g.code+'-'+cam+'-'+i)));
for(const name of batches){
  for(const row of await read(name)){
    assert.ok(!ids.has(row.id),row.id);ids.add(row.id);
    row.frames.forEach(f=>sources.add(f.member));
    const header={id:row.id,source:row.source,camera:row.camera,code:row.code};
    if(row.missing){missing++;await line({type:'undetected',...header,member:row.frames[0].member,archive:row.frames[0].archive});continue;}
    const pattern=assigned.get(row.id);assert.ok(pattern,row.id);
    const clip=prepareTrack(row),frames=[];
    for(const frame of clip.frames){
      const p=learnedPose(clip,frame.at);
      imageErrors.push(projectedError(clip,p,frame));
      for(const k of schema)assert.ok(p.j[k].toArray().every(Number.isFinite),row.id);
      assert.ok(p.center.toArray().every(Number.isFinite),row.id);
      for(const s of ['L','R']){
        assert.ok(Math.min(p.feet[s].toe.y,p.feet[s].heel.y)>-1e-8,row.id);
        for(const [a,b,len] of bonePairs)assert.ok(Math.abs(p.j[a+s].distanceTo(p.j[b+s])-model.lengths[len])<1e-7,row.id);
      }
      frames.push({index:frame.index,archive:frame.archive,member:frame.member,method:frame.method,input2D:frame.input,hasImageDepth:!!frame.world,
        joints:schema.map(k=>rounded(p.j[k])),angles:p.angles,center:rounded(p.center),supportCandidate:[p.feet.L.contact,p.feet.R.contact]});
      poses++;
    }
    await line({type:'track',...header,pattern,comparisonCamera:clip.comparison,frames});
  }
}
assert.equal(assigned.size,stats.tracks);assert.equal(sources.size,stats.images);
assert.equal(poses,stats.poses);assert.equal(missing,stats.missing);assert.equal(ids.size,assigned.size+missing);
zip.end();await writing;await rename(tmp,new URL('motion-library.jsonl.gz',dir));
imageErrors.sort((a,b)=>a-b);assert.ok(imageErrors.every(Number.isFinite));
console.log(JSON.stringify({originalFrames:sources.size,poses,tracks:assigned.size,missing,patterns:groups.length,
  meanImageErrorPerVisibleSkeletonHeight:imageErrors.reduce((a,b)=>a+b,0)/poses,
  p90ImageErrorPerVisibleSkeletonHeight:imageErrors[Math.floor(poses*.9)]}));
