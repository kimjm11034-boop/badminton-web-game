import {readFileSync,writeFileSync,existsSync,createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {Vector3 as Vec,Quaternion as Q,Matrix4,MathUtils,Euler} from '../../vendor/three.module.js';
import {library,prepare,pose} from './strokes.mjs';
const home=new URL('../',import.meta.url),cache=new URL('../../.cache/court-studio/',import.meta.url);
const sk=JSON.parse(readFileSync(new URL('rest.json',cache))),names=sk.map(b=>b.name),rest=Object.fromEntries(sk.map(b=>[b.name,new Vec(...b.head)]));
const V=(...x)=>new Vec(...x),v=a=>V(...a),q=()=>new Q(),diff=(a,b)=>b.clone().sub(a),unit=(a,b)=>diff(a,b).normalize();
const court=p=>V(-p.x,p.y,-p.z),turn=q().setFromAxisAngle(V(0,1,0),Math.PI),rotateCourt=a=>turn.clone().multiply(a).multiply(turn.clone().invert());
const yAxis=V(0,1,0),zAxis=V(0,0,1),clamp=MathUtils.clamp;
function basis(primary,secondary){
 const y=primary.clone().normalize(),x=secondary.clone().addScaledVector(y,-secondary.dot(y));
 if(x.lengthSq()<1e-8)x.copy(Math.abs(y.x)<.7?V(1,0,0):V(0,0,1)).addScaledVector(y,-(Math.abs(y.x)<.7?y.x:y.z));
 x.normalize();return q().setFromRotationMatrix(new Matrix4().makeBasis(x,y,x.clone().cross(y)));
}
function reorient(a,b,c,d){return basis(c,d).multiply(basis(a,b).invert());}
function swing(base,from,to){const src=from.clone().normalize().applyQuaternion(base);return q().setFromUnitVectors(src,to.clone().normalize()).multiply(base);}
function offset(a,b){return diff(rest[a],rest[b]);}
const pelvisRest=rest['upperleg01.L'].clone().lerp(rest['upperleg01.R'],.5);
const tee=Object.fromEntries(library.map(c=>[c.id,prepare(c)]));
const refFile=new URL('references.json',cache);
async function references(){
 if(existsSync(refFile))return JSON.parse(readFileSync(refFile));
 const selected={},templates=library.filter(c=>c.code).map(c=>{const p=pose(c,c.contact);return {c,upper:unit(p.j.shoulderR,p.j.elbowR),fore:unit(p.j.elbowR,p.j.wristR)};});
 const input=createReadStream(new URL('../../motion-lab/catalog/motion-library.jsonl.gz',import.meta.url)).pipe(createGunzip());
 let order;
 for await(const line of createInterface({input,crlfDelay:Infinity})){
  const r=JSON.parse(line);if(r.type==='schema'){order=r.joints;continue;}if(r.type!=='track')continue;
  const choices=templates.filter(t=>t.c.code===r.code);if(!choices.length)continue;
  for(const f of r.frames){const j=Object.fromEntries(order.map((k,i)=>[k,f.joints[i]])),a=unit(v(j.shoulderR),v(j.elbowR)),b=unit(v(j.elbowR),v(j.wristR));
   for(const t of choices){
    const score=(1-a.dot(t.upper))+(1-b.dot(t.fore))*.95+(f.method==='label'?0:.07)+(r.frames.length>1?0:.05);
    if(!selected[t.c.id]||score<selected[t.c.id].score)selected[t.c.id]={score,code:r.code,member:f.member,id:r.id,cam:r.camera,frame:f.index,j,method:f.method};
   }
  }
 }
 writeFileSync(refFile,JSON.stringify(selected));return selected;
}
function solve(pole,hip,ankle,l1,l2){
 const ax=diff(hip,ankle),d=clamp(ax.length(),Math.abs(l1-l2)+.001,l1+l2-.0001);ax.normalize();
 const poleVec=pole.clone().addScaledVector(ax,-pole.dot(ax)).normalize(),a=(l1*l1-l2*l2+d*d)/(2*d);
 return hip.clone().addScaledVector(ax,a).addScaledVector(poleVec,Math.sqrt(Math.max(0,l1*l1-a*a)));
}
function rig(p){
 const positions={},world={},local={},translations={},j=Object.fromEntries(Object.entries(p.j).map(([k,a])=>[k,court(a)]));
 const hip=rotateCourt(p.hipQ),trunk=rotateCourt(p.trunkQ),head=rotateCourt(p.headQ),root=j.pelvis.clone().sub(diff(rest.root,pelvisRest).applyQuaternion(hip));
 if(!p.measured)for(const s of ['L','R']){
  const a='upperleg01.'+s,b='lowerleg01.'+s,f='foot.'+s;
  const h=root.clone().add(offset('root',a).applyQuaternion(hip)),ankle=j['ankle'+s],reach=offset(a,b).length()+offset(b,f).length()-.001;
  const height=Math.sqrt(Math.max(0,reach*reach-(h.x-ankle.x)**2-(h.z-ankle.z)**2));
  root.y-=Math.max(0,h.y-ankle.y-height);
 }
 function set(name,rot){
  const i=names.indexOf(name),par=names[sk[i].parent];world[name]=rot;
  positions[name]=par?positions[par].clone().add((translations[name]||offset(par,name)).clone().applyQuaternion(world[par])):root;
  local[name]=par?world[par].clone().invert().multiply(rot):rot.clone();
 }
 set('root',hip);
 for(const s of ['L','R'])set('pelvis.'+s,hip);
 for(const [i,k] of ['spine05','spine04','spine03','spine02','spine01'].entries())set(k,hip.clone().slerp(trunk,[.24,.45,.66,.87,1][i]));
 for(const k of ['neck01','neck02','neck03','head'])set(k,head);
 for(const s of ['L','R']){
  const n=k=>k+'.'+s;
  const upperLeg=n('upperleg01'),knee=n('lowerleg01'),foot=n('foot'),upperArm=n('upperarm01'),elbow=n('lowerarm01'),wrist=n('wrist');
  const dirs=(a,b)=>unit(j[a+s],j[b+s]);
  const legStart=positions[n('pelvis')].clone().add(offset(n('pelvis'),upperLeg).applyQuaternion(hip));
  const ankle=j['ankle'+s],pole=diff(j['hip'+s],j['knee'+s]);
  const target=solve(pole,legStart,ankle,offset(upperLeg,knee).length(),offset(knee,foot).length());
  if(p.measured){
   // A tiny reach difference near full extension otherwise produces an artificial knee bend.
   const observed=diff(legStart,j['knee'+s]).normalize();
   const axis=diff(legStart,target).normalize().lerp(observed,.88).normalize();
   target.copy(legStart).addScaledVector(axis,offset(upperLeg,knee).length());
  }
  const high=swing(hip,offset(upperLeg,knee),diff(legStart,target)),low=swing(high,offset(knee,foot),diff(target,ankle));
  set(upperLeg,high);set(n('upperleg02'),high);set(knee,low);set(n('lowerleg02'),low);
  set(foot,rotateCourt(p.feet[s].q));
  let upperDir=dirs('shoulder','elbow'),fore=dirs('elbow','wrist');
  const shrug=clamp((upperDir.y+.12)*.33,0,.33),shoulderQ=q().setFromAxisAngle(V(0,0,1),(s==='L'?1:-1)*shrug).multiply(trunk);
  const clav=n('clavicle'),parent=names[sk[names.indexOf(clav)].parent];
  translations[clav]=offset(parent,clav);
  if(p.measured){
   const collar=positions[parent].clone().add(offset(parent,clav).applyQuaternion(world[parent]));
   shoulderQ.copy(swing(trunk,offset(clav,upperArm),diff(collar,j['shoulder'+s])));
   const anchor=collar.clone().add(offset(clav,upperArm).applyQuaternion(shoulderQ));
   // Scapulothoracic glide at the two clavicle bases, capped at 28 mm per side.
   const glide=diff(anchor,j['shoulder'+s]).clampLength(0,.028);
   translations[clav].add(glide.clone().applyQuaternion(world[parent].clone().invert()));anchor.add(glide);
   const bend=solve(diff(anchor,j['elbow'+s]),anchor,j['wrist'+s],offset(upperArm,elbow).length(),offset(elbow,wrist).length());
   upperDir=unit(anchor,bend);fore=unit(bend,j['wrist'+s]);
  }
  set(n('clavicle'),shoulderQ);set(n('shoulder01'),shoulderQ);
  const ua=offset(upperArm,elbow),fa=offset(elbow,wrist),arm=swing(shoulderQ,ua,upperDir);
  // The elbow plane distributes humeral twist. Near full extension the plane is unstable.
  if(upperDir.clone().cross(fore).length()>.18){const anatomical=reorient(ua,fa,upperDir,fore);arm.slerp(anatomical,.82);}
  const foreQ=swing(arm,fa,fore);set(upperArm,arm);set(n('upperarm02'),arm);set(elbow,foreQ);set(n('lowerarm02'),foreQ);
  const across=offset(n('finger5-1'),n('finger2-1')).normalize(),palm=offset(wrist,n('finger3-1')).normalize();
  let hand=foreQ;
  if(s==='R'){
   const shaft=court(p.racketDir).normalize(),forward=fore.clone().addScaledVector(upperDir,.26);
   if(Math.abs(forward.clone().normalize().dot(shaft))>.94)forward.addScaledVector(V(-1,0,0),.32);
   hand=reorient(across,palm,shaft,forward);
   const gripOffset=offset(wrist,n('finger3-1')).multiplyScalar(.79).add(V(.010,-.004,.014));
   const wristPos=positions[elbow].clone().add(offset(elbow,wrist).applyQuaternion(foreQ));
   p.grip=wristPos.add(gripOffset.applyQuaternion(hand));
   p.racketQ=basis(shaft,V(1,0,0).applyAxisAngle(shaft,(p.roll||0)*Math.PI/180));
  }
  set(wrist,hand);
  for(let f=1;f<=5;f++){
   let parent=hand;
   for(let k=1;k<=3;k++){
    const bone=n('finger'+f+'-'+k),axis=offset(n('finger5-1'),n('finger2-1')).normalize();
    const curl=(f===1?.25:f===2?.68:.88)*(s==='R'?1:.18)*(s==='R'?1:-1);
    const rot=parent.clone().multiply(q().setFromAxisAngle(axis,curl));set(bone,rot);parent=rot;
   }
  }
 }
 return {local,translations,root,grip:p.grip,racket:p.racketQ,positions};
}
const refs=await references();
const sensorFile=new URL('sensor.json',cache),sensors=existsSync(sensorFile)?JSON.parse(readFileSync(sensorFile)):[];
const sequences=JSON.parse(readFileSync(new URL('photo.json',cache)));
const matches=JSON.parse(readFileSync(new URL('matches.json',cache)));
const matchDonors={hairpin:'net',under:'lift',push:'push',drive:'drive',defence:'block','net-kill':'kill','fore-serve':'short-serve','high-serve':'long-serve'};
const measuredKeys=['shoulder','elbow','wrist','hip','knee','ankle'];
function captured(frame){
 const j=Object.fromEntries(Object.entries(frame).map(([k,a])=>[k,v(a)]));
 const mid=k=>j[k+'L'].clone().lerp(j[k+'R'],.5);
 j.pelvis=mid('hip');const up=unit(j.pelvis,mid('shoulder'));
 const hipQ=reorient(V(1,0,0),yAxis,unit(j.hipL,j.hipR),up),trunkQ=basis(up,unit(j.shoulderL,j.shoulderR));
 const feet={};
 for(const s of ['L','R']){
  const toe=j['toe'+s],heel=j['heel'+s],fwd=unit(heel,toe);
  const footQ=q().setFromEuler(new Euler(Math.asin(clamp(fwd.y,-1,1)),Math.atan2(-fwd.x,-fwd.z),0,'YXZ'));feet[s]={q:footQ};
 }
 const fore=unit(j.elbowR,j.wristR),hand=unit(j.wristR,j.handR);
 const racketDir=j.shaft||hand.clone().multiplyScalar(.72).addScaledVector(fore,.28).addScaledVector(yAxis,.55).normalize();
 return {j,feet,hipQ,trunkQ,headQ:j.headUp?basis(j.headUp,j.headRight):trunkQ.clone(),racketDir,roll:18,measured:true};
}
const manifests=[],animations=[];
function blended(c,t,ref){
 const p=pose(c,t,ref?.j);
 const donor=c.id==='back-drive'?sensors.find(s=>s.id==='capture-drive-1'):c.family==='후위'&&!c.back?sensors.find(s=>s.id==='capture-clear-1'):matches.find(s=>s.id==='match-'+matchDonors[c.id]);
 if(!donor)return p;
 const u=t<=c.contact?t/c.contact*donor.contact:donor.contact+(t-c.contact)/(1-c.contact)*(1-donor.contact);
 const at=clamp(u,0,1)*(donor.frames.length-1),i=Math.floor(at),a=donor.frames[i],b=donor.frames[Math.min(i+1,donor.frames.length-1)];
 const cp=captured(Object.fromEntries(Object.keys(a).map(k=>[k,a[k].map((v,j)=>MathUtils.lerp(v,b[k][j],at-i))])));
 const weight=.52*Math.sin(Math.PI*t)**.8;
 // The donor faces its own court heading. Transfer the arm paths relative to
 // its rib cage, so the destination's pelvis-led unwind survives blending.
 const align=p.trunkQ.clone().multiply(cp.trunkQ.clone().invert());
 for(const s of ['L','R']){
  const arm=unit(p.j['shoulder'+s],p.j['elbow'+s]).lerp(unit(cp.j['shoulder'+s],cp.j['elbow'+s]).applyQuaternion(align),weight).normalize();
  const fore=unit(p.j['elbow'+s],p.j['wrist'+s]).lerp(unit(cp.j['elbow'+s],cp.j['wrist'+s]).applyQuaternion(align),weight).normalize();
  p.j['elbow'+s]=p.j['shoulder'+s].clone().addScaledVector(arm,.278);p.j['wrist'+s]=p.j['elbow'+s].clone().addScaledVector(fore,.284);
 }
 if(cp.j.shaft)p.racketDir.lerp(cp.racketDir.applyQuaternion(align),weight*.5).normalize();
 return p;
}
for(const c of [...sensors,...matches,...library,...sequences]){
 const sampled=!!c.frames,sequence=c.kind==='sequence',match=c.kind==='match',sensor=sampled&&!sequence&&!match,ref=refs[c.id],fps=60,count=sampled?c.frames.length:Math.ceil(c.seconds*fps)+1;
 const times=Array.from({length:count},(_,i)=>sampled?c.times[i]:i*c.seconds/(count-1)),tracks={};let worstSlip=0,plantError=0,prevFeet={},lastTracks={};
 const errors=[],angles=[],perJoint={};let projected=0,projectedTotal=0,bottom=Infinity,top=-Infinity;
 function put(name,value){
  const a=value.toArray();if(!a.every(Number.isFinite))throw Error(c.id+' '+name);
  const old=lastTracks[name];if(a.length===4&&old&&old.reduce((s,v,i)=>s+v*a[i],0)<0)a.forEach((v,i)=>a[i]=-v);
  lastTracks[name]=a;(tracks[name]??=[]).push(a.map(v=>+v.toFixed(6)));
 }
 for(let i=0;i<count;i++){
  const p=sampled?captured(c.frames[i]):blended(c,i/(count-1),ref),r=rig(p);
  bottom=Math.min(bottom,r.positions['foot.R'].y-.09,r.positions['foot.L'].y-.09);
  top=Math.max(top,r.positions.head.y+.21,r.grip.y+V(0,.592,0).applyQuaternion(r.racket).y);
  put('root/t',r.root);put('racket/t',r.grip);put('racket/q',r.racket);
  for(const [name,value] of Object.entries(r.translations))put(name+'/t',value);
  for(const [name,value] of Object.entries(r.local))put(name+'/q',value);
  if(sensor){
   const map={shoulder:'upperarm01',elbow:'lowerarm01',wrist:'wrist',hip:'upperleg01',knee:'lowerleg01',ankle:'foot'};
   for(const s of ['L','R'])for(const k of measuredKeys){
    const gap=diff(r.positions[map[k]+'.'+s],court(p.j[k+s]));errors.push(gap.length());
    (perJoint[k+s]??=[]).push(gap.length()*100);
    for(let az=0;az<360;az+=5){
     const a=az*Math.PI/180;projected+=Number(Math.hypot(gap.x*Math.cos(a)-gap.z*Math.sin(a),gap.y)<=.03);projectedTotal++;
    }
   }
   for(const s of ['L','R'])for(const [a,b] of [['shoulder','elbow'],['elbow','wrist'],['hip','knee'],['knee','ankle']])angles.push(unit(r.positions[map[a]+'.'+s],r.positions[map[b]+'.'+s]).angleTo(unit(court(p.j[a+s]),court(p.j[b+s])))*180/Math.PI);
  }else if(!sampled)for(const s of ['L','R']){
   const foot=r.positions['foot.'+s],f=p.feet[s];if(f.contact&&prevFeet[s]?.fixed&&Math.abs(f.q.angleTo(prevFeet[s].q))<.00001)worstSlip=Math.max(worstSlip,Math.hypot(foot.x-prevFeet[s].p.x,foot.z-prevFeet[s].p.z));prevFeet[s]={fixed:f.contact,q:f.q,p:foot};
   if(f.contact)plantError=Math.max(plantError,foot.distanceTo(court(f.ankle)));
  }
 }
 // Constant rotations need only endpoints, including finger grip. Keep time arrays uniform for interchange.
 animations.push({id:c.id,times,tracks});
 const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
 const donor=c.family==='후위'&&!c.back?'capture-clear-1':c.id==='back-drive'?'capture-drive-1':matchDonors[c.id]?'match-'+matchDonors[c.id]:null;
 manifests.push({id:c.id,name:c.name,en:c.en,family:c.family,duration:times.at(-1),frames:count,bounds:[bottom,top],contact:c.swing||sampled?c.contact:null,source:match?'match':sequence?'sequence':sensor?'sensor':ref?'photo':donor?'blended':'authored',
  reference:sampled?c.reference:ref?{member:ref.member,camera:ref.cam,code:ref.code,method:ref.method,donor}:donor?{donor}:null,
  evaluation:sensor?{meanCm:mean(errors)*100,within3cm:errors.filter(x=>x<=.03).length/errors.length,projectedWithin3cm:projected/projectedTotal,meanSegmentAngle:mean(angles),jointMeanCm:Object.fromEntries(Object.entries(perJoint).map(([key,list])=>[key,mean(list)]))}:sampled?null:{maxStationaryFootDeltaMm:worstSlip*1000,maxPlantedAnkleTargetErrorMm:plantError*1000}});
}
writeFileSync(new URL('animation.json',cache),JSON.stringify(animations));
writeFileSync(new URL('catalog.json',home),JSON.stringify(manifests,null,2));
console.log(manifests.length,'actions,',animations.reduce((s,c)=>s+c.times.length,0),'samples');console.log(manifests.filter(x=>x.source==='sensor'));
