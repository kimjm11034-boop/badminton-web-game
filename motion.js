import {Euler,Matrix4,Quaternion,Vector3} from './vendor/three.module.js';
import {motionBank} from './data/player-motion-bank.js';
// 3D 관절 리그. 모든 관절과 라켓은 월드 미터 단위 좌표를 사용합니다.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
const norm=a=>{const d=Math.hypot(...a);return d>1e-7?mul(a,1/d):[0,0,1];};
export function solveTwoBone(root,target,upper,lower,pole){
  // 코사인 법칙으로 팔꿈치/무릎 위치를 계산. 뼈 길이가 변하지 않도록 도달 범위를 제한합니다.
  const delta=sub(target,root),d=clamp(Math.hypot(...delta),Math.abs(upper-lower)+.001,upper+lower-.001),axis=norm(delta);
  const p=sub(pole,mul(axis,dot(pole,axis))),bend=norm(Math.hypot(...p)<.0001?[1,0,0]:p);
  const along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  return {joint:add(root,add(mul(axis,along),mul(bend,height))),end:add(root,mul(axis,d))};
}
const V=(x=0,y=0,z=0)=>new Vector3(x,y,z);
const UP=V(0,1,0), {lengths:limb,motions}=motionBank;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const rotated=(v,q)=>v.clone().applyQuaternion(q);
const asWorld=a=>V(a[0],a[2],-a[1]);
const gamePoint=v=>[v.x,-v.z,v.y];
const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const setDir=(v,alt)=>v.lengthSq()>1e-8?v.normalize():alt.clone();

function frameOf(name,t){
  const bank=motions[name],sample=clamp(t,0,1)*(bank.length-1);
  const i=Math.min(bank.length-2,Math.floor(sample));
  return blend(bank[i],bank[i+1],sample-i);
}
function targetFoot(p,i,moving,lead=0){
  const f=-p.side,side=i?1:-1;
  const stance=clamp(motions.ready[0][37]*.45,.18,.26);
  return [p.x+side*f*stance+(moving?p.vx*lead:0),
    p.y+side*f*.048+(moving?p.vy*lead:0),0];
}
export function updateMotion(p,dt,time){
  const speed=Math.hypot(p.vx||0,p.vy||0),moving=speed>.18,f=-p.side;
  let m=p.motion;
  if(!m?.feet||m.version!==2){
    m=p.motion={version:2,cycle:0,feet:[0,1].map(i=>{const pos=targetFoot(p,i,false);return {anchor:pos,position:pos.slice(),swing:false,yaw:i?.13:-.13};}),next:p.vy*f>.3?1:0,active:-1,stepAge:0};
  }
  m.mode=!moving?'READY':p.vy*f>1.4?'LUNGE / CHASSE':p.vy*f< -1?'CROSSOVER BACK':'SIDE CHASSE';
  const duration=clamp(.218-speed*.020,.108,.218);
  if(m.active<0){
    const want=m.feet.map((foot,i)=>{const goal=targetFoot(p,i,moving,.07);return Math.hypot(goal[0]-foot.anchor[0],goal[1]-foot.anchor[1]);});
    let i=m.next;
    if(!moving)i=want[1]>want[0]?1:0;
    if(want[i]>(moving?.145:.115)){
      const foot=m.feet[i];m.active=i;m.stepAge=0;m.duration=duration;
      foot.start=foot.anchor.slice();foot.end=targetFoot(p,i,moving,1.46*duration);
      foot.yawStart=foot.yaw;foot.yawEnd=(i?.13:-.13)+clamp(f*(p.vx||0)*.095,-.40,.4);
      foot.swing=true;
    }
  }
  if(m.active>=0){
    const i=m.active,foot=m.feet[i];m.stepAge+=dt;
    const u=clamp(m.stepAge/m.duration,0,1),s=smooth(u);foot.position=blend(foot.start,foot.end,s);
    foot.position[2]=Math.sin(Math.PI*u)*(.043+Math.min(speed,6)*.017);
    foot.yaw=foot.yawStart+(foot.yawEnd-foot.yawStart)*s;
    m.cycle=(i+u)*.5;
    if(u>=1){foot.anchor=foot.end.slice();foot.position=foot.anchor.slice();foot.swing=false;m.active=-1;m.next=1-i;}
  }
  const support=m.active>=0?m.feet[1-m.active].anchor:[p.x,p.y];
  const follow=1-Math.exp(-dt*12);
  m.balanceX=(m.balanceX||0)+(clamp((support[0]-p.x)*.17,-.055,.055)-(m.balanceX||0))*follow;
  m.balanceY=(m.balanceY||0)+(clamp((support[1]-p.y)*.17,-.055,.055)-(m.balanceY||0))*follow;
}
function orientation(right,up){
  up.normalize();const back=setDir(right.clone().cross(up),V(0,0,1));
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(up.clone().cross(back).normalize(),up,back));
}
function bendChain(a,target,l1,l2,pole){
  const v=target.clone().sub(a),d=clamp(v.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001),axis=setDir(v,V(0,-1,0));
  const along=(l1*l1-l2*l2+d*d)/(2*d);
  const normal=pole.clone().addScaledVector(axis,-pole.dot(axis));
  if(normal.lengthSq()<.00001){normal.crossVectors(axis,Math.abs(axis.y)>.8?V(0,0,1):UP);}
  return {mid:a.clone().addScaledVector(axis,along).addScaledVector(normal.normalize(),Math.sqrt(Math.max(0,l1*l1-along*along))),end:a.clone().addScaledVector(axis,d)};
}
function bodyMotion(p,time,charge,jump){
  const m=p.motion||{},speed=Math.hypot(p.vx||0,p.vy||0),forward=(p.vy||0)*-p.side;
  const cycle=(m.cycle||0)%1;
  const idle=frameOf('ready',.5-.5*Math.cos(time*2.7));
  const walk=blend(frameOf('shuffle',cycle),frameOf('cross',cycle),smooth((-forward-.12)/1.25));
  let frame=blend(idle,walk,smooth(speed/3.2)),name=speed>.4?(forward<-.7?'cross':'shuffle'):'ready';
  const split=clamp((p.react-time)/.12,0,1);
  if(split>0){frame=blend(frame,frameOf('split',1-split),Math.sin(split*Math.PI)*.67);name='split';}
  const low=['lift','net','block','push','drive','serveShort','serveLong'].includes(p.shotType);
  const age=time-(p.swing??-20),active=!!p.shotType&&age>=0&&age<.54;
  const until=p.contactAt-time,anticipation=Number.isFinite(until)&&p.target&&until>=0?smooth(1-until/.42):0;
  const load=Math.max(charge,anticipation*.72);
  const strokeName=jump>.05||['jump','jumpDrop'].includes(p.shotType)?'smash':low?'lunge':'overhead';
  if(active){
    const u=clamp(age/.54,0,1);
    frame=blend(frame,frameOf(strokeName,(low?.52:.55)+u*(low?.48:.45)),1-smooth((u-.52)/.48));name=strokeName;
  }else if(load>.001){
    const prep=charge>.08||Math.abs(p.y)>2.7?'overhead':'lunge';
    frame=blend(frame,frameOf(prep,.13+.31*load),load);name=prep;
  }else if(forward>0&&Math.abs(p.y)<2.7){
    const amount=smooth((2.7-Math.abs(p.y))/1.8)*smooth(forward/1.55);
    frame=blend(frame,frameOf('lunge',.22+.32*amount),amount*.85);name='lunge';
  }
  return {frame,name,age,active,low,cycle,speed};
}
export function buildPose(p,time,{charge=0,jump=0}={}){
  const m=p.motion||{},f=-p.side,face=new Quaternion().setFromAxisAngle(UP,f>0?0:Math.PI);
  const {frame,name,age,active,low,cycle,speed}=bodyMotion(p,time,charge,jump);
  const dir=(k)=>setDir(V(...frame.slice(3*k,3*k+3)),V(0,1,0)).applyQuaternion(face);
  const spine=dir(0),across=dir(1);
  spine.x+=clamp((p.vx||0)*.023,-.12,.12);spine.z-=clamp((p.vy||0)*.022,-.11,.11);
  const trunkQ=orientation(across,spine),yaw=Math.atan2(-across.z*f,across.x*f);
  const hipQ=new Quaternion().setFromAxisAngle(UP,(f<0?Math.PI:0)+yaw*.28);
  const headQ=face.clone().slerp(trunkQ,.36);
  const feet={},offset={};let height=clamp(frame[36]+.083,.67,.925)+jump;
  if(speed>.22)height-=Math.sin(Math.PI*(cycle*2%1))*.024;
  const shift=V(m.balanceX||0,0,-(m.balanceY||0));
  const pelvis=V(p.x+shift.x,height,-p.y+shift.z);
  for(const [i,s] of ['L','R'].entries()){
    const foot=m.feet?.[i],pos=foot?.position||targetFoot(p,i,false);
    const yaw=(f<0?Math.PI:0)-(foot?.yaw??(i?.13:-.13));
    const phase=foot?.swing?clamp(m.stepAge/m.duration,0,1):0;
    const pitch=foot?.swing?Math.sin(phase*Math.PI*2)*-.20:0;
    const q=new Quaternion().setFromEuler(new Euler(pitch,yaw,0,'YXZ'));
    const sole=asWorld(pos);sole.y+=jump;
    const toe=rotated(V(0,0,-.183),q).add(sole),heel=rotated(V(0,0,.078),q).add(sole);
    const up=Math.max(0,-Math.min(toe.y,heel.y));sole.y+=up;toe.y+=up;heel.y+=up;
    const ankle=rotated(V(0,.083,0),q).add(sole);
    feet[s]={q,sole,toe,heel,ankle,contact:!foot?.swing&&jump<.002,yaw:-yaw*180/Math.PI,pivot:toe.y<heel.y?toe:heel};
    offset[s]=rotated(V((i?1:-1)*.101,0,0),hipQ);
  }
  const reach=limb.thigh+limb.shin-.001;
  // Shift weight over the feet before lowering the hips at a rapid change of direction.
  for(let pass=0;pass<3;pass++)for(const s of ['L','R']){
    const a=feet[s].ankle,dx=pelvis.x+offset[s].x-a.x,dz=pelvis.z+offset[s].z-a.z;
    const desiredY=Math.min(height,.735+jump);
    const radius=Math.sqrt(Math.max(.02,reach*reach-(desiredY-a.y)**2)),dist=Math.hypot(dx,dz);
    if(dist>radius){pelvis.x-=dx*(1-radius/dist);pelvis.z-=dz*(1-radius/dist);}
  }
  for(const s of ['L','R']){
    const a=feet[s].ankle,dx=a.x-pelvis.x-offset[s].x,dz=a.z-pelvis.z-offset[s].z;
    pelvis.y=Math.min(pelvis.y,a.y+Math.sqrt(Math.max(0,reach*reach-dx*dx-dz*dz)));
  }
  const local=(v,q=trunkQ)=>rotated(v,q).add(pelvis);
  const j={pelvis,chest:local(V(0,.357,0)),neck:local(V(0,.489,-.004))};
  j.head=rotated(V(0,.133,-.01),headQ).add(j.neck);
  for(const [i,s] of ['L','R'].entries()){
    const sign=i?1:-1,foot=feet[s];j['hip'+s]=pelvis.clone().add(offset[s]);
    const forward=rotated(V(sign*.10,.03,-1),foot.q);
    const leg=bendChain(j['hip'+s],foot.ankle,limb.thigh,limb.shin,forward.lerp(dir(i?6:8),.24));
    j['knee'+s]=leg.mid;j['ankle'+s]=leg.end;j['toe'+s]=foot.toe;j['heel'+s]=foot.heel;
    const upper=dir(i?2:4),fore=dir(i?3:5);
    j['shoulder'+s]=local(V(sign*.198,.423+.022*Math.max(0,upper.y),0));
    j['elbow'+s]=j['shoulder'+s].clone().addScaledVector(upper,limb.upperArm);
    j['wrist'+s]=j['elbow'+s].clone().addScaledVector(fore,limb.forearm);
    j['hand'+s]=j['wrist'+s].clone().addScaledVector(fore,.059);
  }
  const fore=setDir(j.wristR.clone().sub(j.elbowR),UP);
  let racketDir=fore.clone().multiplyScalar(.66).addScaledVector(UP,active&&low?.08:.62).add(rotated(V(.17,0,-.23),face)).normalize();
  const contact=p.contactPoint&&asWorld([p.contactPoint.x,p.contactPoint.y,p.contactPoint.z]);
  if(active&&contact&&age<.24){
    const preferred=racketDir.clone();
    const weight=1-smooth(age/.24),delta=contact.clone().sub(j.shoulderR),d=delta.length(),axis=setDir(delta,UP);
    const radius=.442,reach=limb.upperArm+limb.forearm+.059-.001;
    const cosMin=clamp((d*d+radius*radius-reach*reach)/(2*Math.max(d,.001)*radius),-1,1);
    const proj=racketDir.dot(axis);
    if(proj<cosMin){
      const transverse=racketDir.clone().addScaledVector(axis,-proj);
      if(transverse.lengthSq()<.0001)transverse.crossVectors(axis,Math.abs(axis.y)>.9?V(1,0,0):UP);
      racketDir=axis.clone().multiplyScalar(cosMin).addScaledVector(transverse.normalize(),Math.sqrt(1-cosMin*cosMin)).normalize();
    }
    racketDir=preferred.lerp(racketDir,weight).normalize();
    const target=j.handR.clone().lerp(contact.clone().addScaledVector(racketDir,-radius),weight);
    const arm=bendChain(j.shoulderR,target,limb.upperArm,limb.forearm+.059,j.elbowR.clone().sub(j.shoulderR));
    j.elbowR=arm.mid;j.handR=arm.end;j.wristR=j.elbowR.clone().lerp(j.handR,limb.forearm/(limb.forearm+.059));
  }
  const rig={j,feet,hipQ,trunkQ,headQ,racketDir,roll:active?28-68*smooth(age/.32):16,forearmTwist:active?-.5*smooth(age/.3):0};
  const grip=gamePoint(j.handR),direction=gamePoint(racketDir);
  return {rig,joints:Object.fromEntries(Object.entries(j).map(([k,v])=>[k,gamePoint(v)])),racket:{grip,direction,
    base:gamePoint(j.handR.clone().addScaledVector(racketDir,.442)),tip:gamePoint(j.handR.clone().addScaledVector(racketDir,.570))},
    mode:active?'STROKE':m.mode||'READY',yaw,stroke:active?1-smooth(age/.54):0,movement:name,source:'pooled-player-motion'};
}
