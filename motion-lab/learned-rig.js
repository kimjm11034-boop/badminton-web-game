import {Euler,Matrix4,Quaternion,MathUtils} from '../vendor/three.module.js';
import {V,estimateCenter} from './rig.js';
import {model} from './learned-model.js';

export {model};
const pairs=[[0,6],[1,7],[6,8],[7,9],[8,10],[9,11]];
function normalized(points){
  const origin=points[6].map((v,k)=>(v+points[7][k])/2);
  const size=Math.max(1,pairs.reduce((sum,[a,b])=>sum+Math.hypot(points[a][0]-points[b][0],points[a][1]-points[b][1]),0)/2);
  return {origin,size,x:points.flatMap(p=>p.map((v,k)=>(v-origin[k])/size))};
}
function affine(features,weights,intercept){
  const result=intercept.slice();
  features.forEach((v,i)=>{for(let j=0;j<result.length;j++)result[j]+=v*weights[i][j];});
  return result;
}
export function infer(points){
  const {x,origin,size}=normalized(points);
  const rbf=model.anchors.map(c=>Math.exp(-model.gamma*c.reduce((d,v,i)=>d+(v-x[i])**2,0)));
  const y=affine([...x,...rbf],model.weights,model.intercept);
  const torso=affine(x,model.centerline.weights,model.centerline.intercept).map((v,i)=>v*size+origin[i%2]);
  return {landmarks:Object.fromEntries(model.names.map((k,i)=>[k,V(...y.slice(i*3,i*3+3))])),
    centerline:model.centerline.keys.map((_,i)=>torso.slice(i*2,i*2+2))};
}
const unit=(a,b,fallback=V(0,-1,0))=>{const d=b.clone().sub(a);return d.lengthSq()>.00001?d.normalize():fallback.clone();};
function basis(side,up){
  const y=up.normalize(),z=side.clone().cross(y);
  if(z.lengthSq()<.0001)return new Quaternion();
  z.normalize();const x=y.clone().cross(z);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
}
function retarget(raw){
  const d=model.lengths,j={pelvis:V()},feet={};
  const mid=(a,b)=>raw[a].clone().lerp(raw[b],.5);
  const shoulder=mid('shoulderL','shoulderR'),hips=mid('hipL','hipR');
  const trunkQ=basis(unit(raw.shoulderL,raw.shoulderR),unit(hips,shoulder));
  const hipQ=basis(unit(raw.hipL,raw.hipR),V(0,1,0));
  const headQ=basis(unit(raw.earL,raw.earR),unit(shoulder,mid('earL','earR'),V(0,1,0)));
  j.chest=V(0,.357,0).applyQuaternion(trunkQ);j.neck=V(0,.489,-.004).applyQuaternion(trunkQ);
  j.head=V(0,.133,-.01).applyQuaternion(headQ).add(j.neck);
  for(const s of ['L','R']){
    const sign=s==='R'?1:-1;
    j['hip'+s]=V(.101*sign,0,0).applyQuaternion(hipQ);
    j['shoulder'+s]=V(.198*sign,.423,0).applyQuaternion(trunkQ);
    for(const [a,b,len] of [['shoulder','elbow',d.upperArm],['elbow','wrist',d.forearm],['wrist','hand',.059],['hip','knee',d.thigh],['knee','ankle',d.shin]]){
      j[b+s]=j[a+s].clone().addScaledVector(unit(raw[a+s],raw[b+s]),len);
    }
    const forward=unit(raw['heel'+s],raw['toe'+s],V(0,0,-1));
    const yaw=Math.atan2(forward.x,-forward.z);
    const pitch=MathUtils.clamp(Math.asin(MathUtils.clamp(forward.y,-1,1)),-.78,.52);
    const q=new Quaternion().setFromEuler(new Euler(pitch,-yaw,0,'YXZ'));
    const ankle=j['ankle'+s],sole=ankle.clone().sub(V(0,.083,0).applyQuaternion(q));
    const toe=V(0,0,-.183).applyQuaternion(q).add(sole),heel=V(0,0,.078).applyQuaternion(q).add(sole);
    j['toe'+s]=toe;j['heel'+s]=heel;
    feet[s]={sole,q,toe,heel,ankle,yaw:yaw*180/Math.PI,pivot:toe.y<heel.y?toe:heel};
  }
  const floor=Math.min(feet.L.pivot.y,feet.R.pivot.y),primary=feet.L.pivot.y<=feet.R.pivot.y?'L':'R';
  for(const s of ['L','R'])feet[s].contact=feet[s].pivot.y-floor<.035;
  const angle=(a,b,c)=>+(j[a].clone().sub(j[b]).angleTo(j[c].clone().sub(j[b]))*180/Math.PI).toFixed(1);
  const angles={};
  for(const s of ['L','R']){
    angles['knee'+s]=angle('hip'+s,'knee'+s,'ankle'+s);
    angles['elbow'+s]=angle('shoulder'+s,'elbow'+s,'wrist'+s);
  }
  const pose={j,feet,angles,hipQ,trunkQ,headQ,primary,center:estimateCenter(j),racketObserved:false,
    racketDir:V(0,.65,-.76).normalize(),roll:0,forearmTwist:0};
  translate(pose,V(0,-floor,0));return pose;
}
function translate(p,delta){
  for(const v of Object.values(p.j))v.add(delta);
  for(const f of Object.values(p.feet))f.sole.add(delta);
  p.center.add(delta);
}
const candidateViews=[];
for(let deg=-180;deg<180;deg+=4)for(let elevation=0;elevation<=48;elevation+=3){
  const angle=deg*Math.PI/180,pitch=elevation*Math.PI/180;
  const c=Math.cos(angle),s=Math.sin(angle),co=Math.cos(pitch),si=Math.sin(pitch);
  const dx=c,dz=-s,ux=-si*s,uy=co,uz=-si*c;
  candidateViews.push({angle,pitch,dx,dz,ux,uy,uz,variance:[dx*dx+ux*ux,uy*uy,dz*dz+uz*uz,2*ux*uy,2*(dx*dz+ux*uz),2*uy*uz]});
}
// Score each weak-perspective view from the fixed per-frame covariance.
function comparisonView(frames){
  const observations=frames.map(f=>{
    const p=retarget(f.landmarks),world=model.names.slice(0,12).map(k=>p.j[k].clone());
    const mean=world.reduce((sum,v)=>sum.add(v),V()).divideScalar(world.length);
    world.forEach(v=>v.sub(mean));
    const xy=f.input,ox=xy.reduce((n,p)=>n+p[0],0)/xy.length,oy=xy.reduce((n,p)=>n+p[1],0)/xy.length;
    const uv=xy.map(([x,y])=>[x-ox,oy-y]);
    const moments=[0,0,0,0,0,0],horizontal=V(),vertical=V();
    world.forEach(({x,y,z},i)=>{
      moments[0]+=x*x;moments[1]+=y*y;moments[2]+=z*z;
      moments[3]+=x*y;moments[4]+=x*z;moments[5]+=y*z;
      horizontal.addScaledVector(world[i],uv[i][0]);vertical.addScaledVector(world[i],uv[i][1]);
    });
    return {moments,horizontal,vertical,norm:Math.sqrt(uv.reduce((n,[x,y])=>n+x*x+y*y,0))};
  });
  let best=-Infinity,view;
  for(const {angle,pitch,dx,dz,ux,uy,uz,variance} of candidateViews){
    let score=0;
    for(const {moments,horizontal,vertical,norm} of observations){
      const dot=dx*horizontal.x+dz*horizontal.z+ux*vertical.x+uy*vertical.y+uz*vertical.z;
      let r2=0;for(let i=0;i<6;i++)r2+=variance[i]*moments[i];
      score+=dot/(norm*Math.sqrt(Math.max(0,r2))||1);
    }
    if(score>best){best=score;view={angle,pitch};}
  }
  return view;
}
// Match visible limb directions in the image plane. Depth along the viewing ray
// stays with the source estimate/learned prior. Retarget then restores bone lengths.
function alignToPhoto(frame,view){
  const {landmarks,input}=frame;
  const side=V(Math.cos(view.angle),0,-Math.sin(view.angle));
  const up=V(-Math.sin(view.pitch)*Math.sin(view.angle),Math.cos(view.pitch),-Math.sin(view.pitch)*Math.cos(view.angle));
  const pixelHip=input[6].map((v,i)=>(v+input[7][i])/2);
  const hip=landmarks.hipL.clone().lerp(landmarks.hipR,.5);
  let cross=0,total=0;
  const vectors=model.names.slice(0,12).map((key,i)=>{
    const delta=landmarks[key].clone().sub(hip),x=delta.dot(side),y=delta.dot(up);
    const u=input[i][0]-pixelHip[0],v=pixelHip[1]-input[i][1];
    cross+=x*u+y*v;total+=x*x+y*y;
    return {key,x,y,u,v};
  });
  const scale=cross/total;
  if(!(scale>5))return;
  const offsets={};
  for(const {key,x,y,u,v} of vectors){
    const offset=side.clone().multiplyScalar(u/scale-x).addScaledVector(up,v/scale-y).clampLength(0,.42);
    offsets[key]=offset;landmarks[key].add(offset);
  }
  for(const s of ['L','R']){
    landmarks['hand'+s].add(offsets['wrist'+s]);
    landmarks['toe'+s].add(offsets['ankle'+s]);landmarks['heel'+s].add(offsets['ankle'+s]);
  }
  const extra=frame.reviewPoints;
  if(!extra)return;
  function alignPoint(target,uv){
    const d=target.clone().sub(hip);
    target.addScaledVector(side,(uv[0]-pixelHip[0])/scale-d.dot(side));
    target.addScaledVector(up,(pixelHip[1]-uv[1])/scale-d.dot(up));
  }
  for(const key of ['handL','handR','heelL','heelR','toeL','toeR'])if(extra[key])alignPoint(landmarks[key],extra[key]);
  if(extra.head){
    const mid=landmarks.earL.clone().lerp(landmarks.earR,.5),to=mid.clone();alignPoint(to,extra.head);
    const shift=to.sub(mid);landmarks.earL.add(shift);landmarks.earR.add(shift);
  }
  const torso=['neck','chest','belly'],shift=V();
  let count=0;
  for(const [i,name] of torso.entries()){
    const uv=extra[name],prior=frame.centerline[i+1];
    if(!uv)continue;
    shift.addScaledVector(side,(uv[0]-prior[0])/scale).addScaledVector(up,(prior[1]-uv[1])/scale);
    count++;
  }
  if(count){
    shift.multiplyScalar(1/count).clampLength(0,.16);
    landmarks.shoulderL.add(shift);landmarks.shoulderR.add(shift);
  }
}
export function prepareTrack(track){
  const first=track.frames[0].index,last=track.frames.at(-1).index;
  const frames=track.frames.map(f=>{
    const prediction=infer(f.input);
    if(f.world)model.names.forEach((k,i)=>prediction.landmarks[k].lerp(V(...f.world[i]),.80));
    return {...f,...prediction,at:(f.index-first)/Math.max(1,last-first)};
  });
  const comparison=comparisonView(frames);
  if(track.code)for(const frame of frames){
    alignToPhoto(frame,comparison);
    frame.centerline=['head','neck','chest','belly'].map((key,i)=>frame.reviewPoints?.[key]||frame.centerline[i]);
  }
  // XY court travel is unavailable. Anchor the common low foot between consecutive estimates.
  let prev;
  for(const frame of frames){
    const p=retarget(frame.landmarks);const shift=prev?prev.shift.clone():V();
    if(prev){
      const s=p.feet[prev.pose.primary].contact?prev.pose.primary:p.primary;
      if(prev.pose.feet[s].contact&&p.feet[s].contact){
        shift.add(prev.pose.feet[s].pivot.clone().sub(p.feet[s].pivot));shift.y=0;
      }
    }
    frame.shift=shift;prev={pose:p,shift};
  }
  return {...track,learned:true,frames,comparison,group:'원본 동작',duration:2.4,preview:frames[Math.floor(frames.length/2)].at,
    phases:frames.map(f=>({at:f.at,name:'표본 '+f.index}))};
}
export function sampleAt(clip,t){
  if(clip.frames.length===1){const f=clip.frames[0];return {a:f,b:f,u:0,nearest:f};}
  let i=0;while(i<clip.frames.length-2&&t>clip.frames[i+1].at)i++;
  const a=clip.frames[i],b=clip.frames[i+1],u=MathUtils.clamp((t-a.at)/(b.at-a.at),0,1);
  return {a,b,u,nearest:u<=.5?a:b};
}
export function learnedPose(clip,t){
  const {a,b,u}=sampleAt(clip,t);
  const raw=Object.fromEntries(model.names.map(k=>[k,a.landmarks[k].clone().lerp(b.landmarks[k],u)]));
  const p=retarget(raw),delta=a.shift.clone().lerp(b.shift,u);
  // Keep the most likely supporting sole endpoint fixed across the interpolated span.
  if(u>0&&u<1){
    const pa=retarget(a.landmarks),pb=retarget(b.landmarks);
    const s=pb.feet[pa.primary].contact?pa.primary:pb.primary;
    if(pa.feet[s].contact&&pb.feet[s].contact){
      const fixed=pa.feet[s].pivot.clone().add(a.shift).lerp(pb.feet[s].pivot.clone().add(b.shift),u);
      delta.x=fixed.x-p.feet[s].pivot.x;delta.z=fixed.z-p.feet[s].pivot.z;
    }
  }
  translate(p,delta);return p;
}

