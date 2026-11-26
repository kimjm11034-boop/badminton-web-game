import { Vector3, Quaternion, Euler, MathUtils } from '../vendor/three.module.js';
import { footworkClips } from '../footwork-clips.js';

const rad = Math.PI / 180;
export const V = (x=0,y=0,z=0) => new Vector3(x,y,z);
const up=V(0,1,0);
const mix=MathUtils.lerp;
const ease=t=>t*t*(3-2*t);
const clamp=MathUtils.clamp;
export const lengths = { thigh:.445, shin:.430, upperArm:.313, forearm:.259 };
export const bones = [['pelvis','chest'],['chest','neck'],['neck','head']];
for(const s of ['L','R']) bones.push(['pelvis','hip'+s],['hip'+s,'knee'+s],['knee'+s,'ankle'+s],['ankle'+s,'toe'+s],['chest','shoulder'+s],['shoulder'+s,'elbow'+s],['elbow'+s,'wrist'+s],['wrist'+s,'hand'+s]);

function interval(keys,t) {
  let i=0;
  while(i<keys.length-2 && t>keys[i+1][0]) i++;
  return [i,clamp((t-keys[i][0])/(keys[i+1][0]-keys[i][0]),0,1)];
}
// Shape-preserving Hermite slopes keep the root moving through intermediate samples.
function sample(keys,t) {
  const [i,u]=interval(keys,t), a=keys[i], b=keys[i+1], span=b[0]-a[0];
  const tangent=(j,k)=>{
    if(j===0||j===keys.length-1)return 0;
    const prev=keys[j-1], cur=keys[j], next=keys[j+1];
    const p=(cur[k]-prev[k])/(cur[0]-prev[0]), n=(next[k]-cur[k])/(next[0]-cur[0]);
    return p*n>0 ? 2*p*n/(p+n) : 0;
  };
  return a.slice(1).map((v,k)=>mix(v,b[k+1],ease(u))+span*u*(1-u)*((1-u)*tangent(i,k+1)-u*tangent(i+1,k+1)));
}
function footPose(clip,t,s) {
  let [x,z,yaw]=clip.start[s], h=0, inAir=false;
  for(const a of clip.steps) {
    if(a.side!==s||t<=a.from)continue;
    if(t>=a.to){x=a.x; z=a.z; yaw=a.yaw; continue;}
    const u=(t-a.from)/(a.to-a.from), e=ease(u);
    x=mix(x,a.x,e); z=mix(z,a.z,e); yaw=mix(yaw,a.yaw,e);
    h=a.lift*Math.sin(Math.PI*u);
    inAir=true; break;
  }
  const pitch=(clip.footRoll?.[s]?sample(clip.footRoll[s],t)[0]:0)*rad;
  const q=new Quaternion().setFromEuler(new Euler(pitch,-yaw*rad,0,'YXZ'));
  // Heel strike rolls about the heel, trailing plantar flexion about the toe.
  const pivotZ=pitch>0?.078:-.183;
  const yawQ=new Quaternion().setFromAxisAngle(up,-yaw*rad);
  const pivot=V(0,0,pivotZ);
  const sole=V(x,h,z).add(pivot.clone().applyQuaternion(yawQ)).sub(pivot.clone().applyQuaternion(q));
  const at=(px,py,pz)=>V(px,py,pz).applyQuaternion(q).add(sole);
  return {sole,q,ankle:at(0,.083,0),toe:at(0,0,-.183),heel:at(0,0,.078),yaw,contact:!inAir,pivot:at(0,0,pivotZ)};
}
function knee(hip,ankle,forward,dimensions) {
  const axis=ankle.clone().sub(hip), d=axis.length(); axis.normalize();
  const along=(dimensions.thigh**2-dimensions.shin**2+d*d)/(2*d);
  const pole=forward.clone().addScaledVector(axis,-forward.dot(axis)).normalize();
  return hip.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,dimensions.thigh**2-along**2)));
}

// Only the four neutral arm directions use the measured 90 s sample.
// Retargeted source axes are right/forward/up, converted to right/up/back here.
const ref=footworkClips[0].joints;
const measured=(a,b)=>V(ref[b][0]-ref[a][0],ref[b][2]-ref[a][2],ref[a][1]-ref[b][1]).normalize().toArray();
const ready=[measured('shoulderR','elbowR'),measured('elbowR','wristR'),measured('shoulderL','elbowL'),measured('elbowL','wristL'),[.32,.70,-.50],12];
const poses={
  ready,
  side:[[.56,-.8,-.3],[-.1,.19,-.98],[-.8,-.55,.12],[-.55,.01,-.7],[.47,.77,-.45],22],
  counter:[[.79,-.57,.17],[.32,.07,-.85],[-.56,-.73,-.39],[.26,.23,-.92],[.58,.67,-.47],18],
  draw:[[.47,-.8,.18],[.55,-.04,-.88],[-.57,-.71,-.28],[.14,.15,-.97],[.76,.6,-.13],36],
  reach:[[.46,-.48,-.77],[.33,-.17,-.93],[-.62,-.61,.51],[-.62,-.08,.76],[.50,.26,-.82],58],
  net:[[.42,-.39,-.83],[.30,-.26,-.91],[-.65,-.36,.67],[-.6,-.06,.81],[.41,.12,-.91],66],
  turn:[[.89,-.20,.42],[.10,.86,-.49],[-.42,.1,-.91],[-.18,.83,-.51],[.44,.87,.24],45],
  load:[[.92,.24,.31],[-.08,.88,.47],[-.38,.63,-.68],[-.12,.80,-.58],[-.26,.46,.85],72],
  lead:[[.71,.60,-.37],[-.34,.12,.93],[-.59,-.44,-.68],[.45,.55,-.70],[-.51,-.72,.49],102],
  whip:[[.38,.90,-.17],[-.06,.84,.53],[-.54,-.78,-.25],[.56,.44,-.72],[.28,.13,.95],78],
  strike:[[.32,.92,-.20],[.16,.94,-.31],[-.49,-.83,.21],[.59,.20,-.77],[.19,.90,-.40],13],
  follow:[[-.08,.31,-.94],[-.60,-.53,-.59],[-.72,-.62,.26],[.27,.15,-.94],[-.69,-.55,-.46],-62],
  finish:[[-.10,-.76,-.64],[-.85,-.39,-.36],[-.70,-.65,.19],[.26,.19,-.95],[-.77,-.61,.13],-45]
};
function armState(clip,t) {
  const [i,u]=interval(clip.gestures,t), a=poses[clip.gestures[i][1]], b=poses[clip.gestures[i+1][1]];
  return [...a.slice(0,5).map((v,k)=>V(...v).normalize().lerp(V(...b[k]).normalize(),ease(u)).normalize()),mix(a[5],b[5],ease(u))];
}
const jointAngle=(a,b,c)=>Math.round(a.clone().sub(b).angleTo(c.clone().sub(b))/rad*10)/10;
export function evaluatePose(clip,time,dimensions=lengths) {
  const t=clamp(time,0,1);
  const [x,height,z,hipYaw,chestYaw,lean,tilt]=sample(clip.root,t);
  const feet={L:footPose(clip,t,'L'),R:footPose(clip,t,'R')};
  const hipQ=new Quaternion().setFromEuler(new Euler(-lean*.19*rad,-hipYaw*rad,-tilt*.45*rad,'YXZ'));
  const trunkQ=new Quaternion().setFromEuler(new Euler(-lean*rad,-chestYaw*rad,-tilt*rad,'YXZ'));
  const overhead=clip.id==='overhead'||clip.id==='smash';
  const gaze=overhead?sample([[0,0],[.18,13],[.37,28],[.51,33],[.60,20],[.76,2],[1,0]],t)[0]:0;
  const headQ=new Quaternion().setFromEuler(new Euler((gaze-lean*.20)*rad,-chestYaw*.42*rad,-tilt*.33*rad,'YXZ'));
  const hipOffsets={L:V(-.101,0,0).applyQuaternion(hipQ),R:V(.101,0,0).applyQuaternion(hipQ)};
  let y=height;
  for(const s of ['L','R']){
    const o=hipOffsets[s],a=feet[s].ankle;
    const reach=dimensions.thigh+dimensions.shin-.003;
    y=Math.min(y,a.y-o.y+Math.sqrt(Math.max(0,reach**2-(a.x-x-o.x)**2-(a.z-z-o.z)**2)));
  }
  const j={pelvis:V(x,y,z)};
  const trunk=(a,b,c)=>V(a,b,c).applyQuaternion(trunkQ).add(j.pelvis);
  j.chest=trunk(0,.357,0); j.neck=trunk(0,.489,-.004);
  j.head=V(0,.133,-.01).applyQuaternion(headQ).add(j.neck);
  const [rUpper,rFore,lUpper,lFore,racket,roll]=armState(clip,t);
  for(const s of ['L','R']){
    const sign=s==='R'?1:-1, foot=feet[s];
    j['hip'+s]=j.pelvis.clone().add(hipOffsets[s]);
    j['ankle'+s]=foot.ankle; j['toe'+s]=foot.toe; j['heel'+s]=foot.heel;
    const fwd=V(Math.sin(foot.yaw*rad),0,-Math.cos(foot.yaw*rad));
    j['knee'+s]=knee(j['hip'+s],foot.ankle,fwd,dimensions);
    const upper=(sign>0?rUpper:lUpper).applyQuaternion(trunkQ);
    const fore=(sign>0?rFore:lFore).applyQuaternion(trunkQ);
    j['shoulder'+s]=trunk(sign*(.198+Math.max(0,upper.x*sign)*.012),.423+Math.max(0,upper.y)*.035,Math.min(0,upper.z)*.024);
    j['elbow'+s]=j['shoulder'+s].clone().addScaledVector(upper,dimensions.upperArm);
    j['wrist'+s]=j['elbow'+s].clone().addScaledVector(fore,dimensions.forearm);
    j['hand'+s]=j['wrist'+s].clone().addScaledVector(fore,.059);
  }
  const racketDir=racket.applyQuaternion(trunkQ);
  // Segment mass fractions yield a visual estimate of whole-body centre of mass.
  const center=estimateCenter(j);
  return {j,feet,center,hipQ,trunkQ,headQ,racketDir,roll,forearmTwist:(roll-12)*.62*rad,angles:{
    kneeR:jointAngle(j.hipR,j.kneeR,j.ankleR),kneeL:jointAngle(j.hipL,j.kneeL,j.ankleL),
    elbowR:jointAngle(j.shoulderR,j.elbowR,j.wristR),elbowL:jointAngle(j.shoulderL,j.elbowL,j.wristL)
  }};
}
export function estimateCenter(j){
  const center=V();
  for(const [a,b,w] of [['pelvis','chest',.43],['neck','head',.084]])center.addScaledVector(j[a].clone().lerp(j[b],.55),w);
  for(const s of ['L','R'])for(const [a,b,w,f] of [['hip','knee',.126,.43],['knee','ankle',.045,.43],['ankle','toe',.014,.43],['shoulder','elbow',.029,.44],['elbow','wrist',.017,.43],['wrist','hand',.012,.55]])
    center.addScaledVector(j[a+s].clone().lerp(j[b+s],f),w);
  return center;
}

