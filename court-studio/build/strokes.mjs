import {clips} from '../../motion-lab/clips.js';
import {evaluatePose,V} from '../../motion-lab/rig.js';
import {Quaternion,Euler} from '../../vendor/three.module.js';
const vec=a=>V(...a).normalize(),mix=(a,b,u)=>vec(a).lerp(vec(b),u).normalize();
const ease=x=>x*x*(3-2*x);
const ready=[[.63,-.72,-.30],[-.36,.40,-.83],[.23,.86,-.43]];
// Court coordinates: +X racket side, +Y height and -Z towards the net.
// Upper arm, forearm and shaft each have their own timing and follow-through.
const swings={
 net:[[.70,-.55,-.48],[.42,.27,-.87],[.63,.16,-.76],[.35,.01,-.94],[.34,.22,-.92]],
 lift:[[.65,-.71,-.24],[.42,-.77,-.47],[.67,-.51,-.54],[.43,-.39,-.81],[.40,-.62,-.67]],
 push:[[.64,-.58,-.49],[-.19,.57,-.80],[.40,-.20,-.90],[.32,.05,-.95],[.20,.48,-.85]],
 drive:[[.96,-.13,.22],[.24,.94,.22],[.73,-.07,-.68],[.46,.13,-.88],[.44,.78,-.45]],
 block:[[.67,-.70,-.21],[-.30,.57,-.76],[.65,-.63,-.42],[.22,.08,-.97],[.65,.22,-.72]],
 serve:[[.40,-.90,.03],[-.45,.06,-.89],[.45,-.86,-.23],[-.22,-.18,-.95],[-.69,-.57,-.45]],
 overhead:[[.85,.40,.28],[-.43,.58,.69],[.37,.86,-.35],[.18,.90,-.39],[.26,.89,-.37]],
 smash:[[.88,.35,.32],[-.45,.52,.72],[.45,.80,-.39],[.30,.77,-.56],[.33,.66,-.67]],
 drop:[[.86,.42,.30],[-.42,.59,.68],[.45,.85,-.27],[.26,.91,-.33],[.30,.83,-.47]],
 slice:[[.91,.28,.31],[-.48,.51,.72],[.56,.79,-.25],[-.04,.90,-.44],[-.28,.80,-.53]],
 kill:[[.86,.05,.49],[-.12,.94,.31],[.45,.38,-.81],[.27,.21,-.94],[.45,.30,-.84]]
};
const C=(id,name,en,family,swing,code,seconds,back=false,style=1)=>({id,name,en,family,swing,code,seconds,back,style});
export const library=[
 C('jump-smash','점프 스매시','Jump smash','후위','smash','SMS-FSM',1.55),
 C('smash','포핸드 스매시','Forehand smash','후위','smash','SMS-FSM',1.32),
 C('back-smash','백핸드 스매시','Backhand smash','후위','smash','SMS-BSM',1.42,true),
 C('high-clear','하이 클리어','High clear','후위','overhead','CLR-HIC',1.53),
 C('flat-clear','드리븐 클리어','Attacking clear','후위','overhead','CLR-DNC',1.32,false,.77),
 C('drop','포핸드 드롭','Drop shot','후위','drop','DRP-FDR',1.48),
 C('back-drop','백핸드 드롭','Backhand drop','후위','drop','DRP-BDR',1.42,true),
 C('cut','포핸드 커트','Forehand slice','후위','slice','CUT-FCU',1.42),
 C('back-cut','백핸드 커트','Backhand slice','후위','slice','CUT-BCU',1.4,true),
 C('hairpin','포핸드 헤어핀','Forehand net shot','전위','net','HPN-FHP',1.82),
 C('back-hairpin','백핸드 헤어핀','Backhand net shot','전위','net','HPN-BHP',1.85,true),
 C('under','포핸드 언더 클리어','Forehand lift','전위','lift','CLR-UDC',1.69),
 C('back-under','백핸드 언더 클리어','Backhand lift','전위','lift','CLR-UDC',1.73,true),
 C('push','포핸드 푸시','Forehand push','전위','push','PSH-FPS',1.29),
 C('back-push','백핸드 푸시','Backhand push','전위','push','PSH-BPS',1.28,true),
 C('net-kill','네트 킬','Net kill','전위','kill',null,1.17),
 C('drive','포핸드 드라이브','Forehand drive','중위','drive','DRV-FDV',1.06),
 C('back-drive','백핸드 드라이브','Backhand drive','중위','drive','DRV-BDV',1.11,true),
 C('defence','포핸드 블록 수비','Forehand block','중위','block',null,1.03),
 C('back-defence','백핸드 블록 수비','Backhand block','중위','block',null,.99,true),
 C('short-serve','백핸드 쇼트 서브','Short serve','서브','serve','SRV-BSS',1.54,true),
 C('fore-serve','포핸드 쇼트 서브','Forehand serve','Forehand serve','serve','SRV-FSS',1.67),
 C('flick','백핸드 플릭 서브','Flick serve','서브','serve','SRV-BLH',1.4,true,1.5),
 C('high-serve','포핸드 롱 서브','High serve','서브','lift',null,1.68,false,1.28),
 ...[['ready','준비 자세','Ready position'],['split','스플릿 스텝','Split step'],['shuffle','사이드 샤세','Chassé'],['cross','후방 크로스오버','Crossover'],['lunge','전위 런지·회복','Lunge and recovery']].map(([id,name,en])=>C(id,name,en,'풋워크',null,null,clips.find(c=>c.id===id).duration))
];
library.find(c=>c.id==='fore-serve').family='서브';
const ref=Object.fromEntries(clips.map(c=>[c.id,c]));
function track(c){
 if(!c.swing)return ref[c.id];
 const family=c.family,base=ref[c.id==='jump-smash'?'smash':family==='후위'?'overhead':family==='전위'?'lunge':'ready'];
 const mult=family==='전위'?(c.back?-.60:1):1;
 const def=c.swing==='block',serve=family==='서브';
 const root=base.root.map(([t,x,y,z,hy,cy,lean,tilt])=>[t,x*mult,y-(def?.065:0),z,hy*(c.back?-.65:1),cy*(c.back?-1:1),lean,tilt*mult]);
 if(base.id==='ready'){
  const power=serve?.48:def?.61:1,dir=c.back?-1:1;
  return {...base,root:[[0,0,.80,0,0,0,14,0],[.25,dir*.050,.78-(def?.065:0),.02,dir*8,dir*17*power,17,0],[.47,dir*.09,.75-(def?.06:0),.018,dir*9,dir*25*power,19,dir*3],[.59,dir*.08,.80-(def?.07:0),-.04,-dir*5,-dir*14*power,16,dir*3],[.74,dir*.04,.79,-.045,-dir*8,-dir*21*power,16,0],[1,0,.80,0,0,0,14,0]]};
 }
 if(c.back&&family==='후위'){
  const steps=base.steps.map(s=>s.to<.30?{...s,x:.005,z:.31,yaw:-51}:s.to<.80?{...s,x:.18,z:-.14,yaw:-12}:{...s});
  steps.push({side:'L',from:.015,to:.14,x:-.26,z:.06,yaw:-39,lift:.045},{side:'L',from:.79,to:.94,x:-.24,z:.03,yaw:-10,lift:.045});
  return {...base,root:root.map(([t,x,...r])=>[t,-x,...r]),steps};
 }
 return {...base,root,steps:base.steps.map(s=>({...s,x:c.back&&base.id==='lunge'&&s.to<.70?-.38:s.x,yaw:c.back&&base.id==='lunge'&&s.to<.70?-21:s.yaw}))};
}
export const rigLength={thigh:.46,shin:.47,upperArm:.278,forearm:.284};
// Court yaw in degrees: loading puts the racket shoulder behind the pelvis.
// The first pair is preparation, the second pair is the end of the stroke.
const bodyTurns={
 smash:[43,72,-30,-48],overhead:[39,67,-24,-43],drop:[36,63,-18,-29],
 slice:[37,66,-15,-24],drive:[23,42,-15,-31],block:[8,16,-5,-11],
 net:[-8,-13,-19,-30],lift:[7,18,-23,-39],push:[5,15,-17,-30],
 kill:[12,26,-19,-35],serve:[7,12,-5,-10]
};
function turnKeys(c){
 let [hp,cp,hf,cf]=bodyTurns[c.swing];
 if(c.back){
  if(c.family==='후위'){hp=-67;cp=-103;hf=-17;cf=c.swing==='smash'?17:6;}
  else if(c.family==='전위'){hp=-14;cp=-28;hf=-6;cf=9;}
  else {hp*=-1;cp*=-1;hf*=-1;cf*=-1;}
 }
 if(c.id==='high-serve'){hp=23;cp=39;hf=-16;cf=-29;}
 if(c.id==='short-serve'){hp=-4;cp=-9;hf=1;cf=5;}
 if(c.id==='flat-clear'){hp*=.88;cp*=.92;hf*=.85;cf*=.87;}
 const hit=c.contact;
 // Relative to estimated impact: load, pelvis reversal, thorax release, deceleration.
 return {hip:[[0,0],[hit-.25,hp],[hit-.18,hp*.94],[hit-.065,hf*.56],[hit+.04,hf],[hit+.15,hf*.92],[1,0]],
 chest:[[0,0],[hit-.19,cp*.94],[hit-.14,cp],[hit-.075,cp*.64],[hit+.012,cf*.66],[hit+.085,cf],[hit+.18,cf*.87],[1,0]]};
}
function sampleTurn(keys,t){
 let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],dx=b[0]-a[0],u=Math.min(1,Math.max(0,(t-a[0])/dx));
 const slope=k=>{
  if(!k||k===keys.length-1)return 0;
  const left=(keys[k][1]-keys[k-1][1])/(keys[k][0]-keys[k-1][0]),right=(keys[k+1][1]-keys[k][1])/(keys[k+1][0]-keys[k][0]);
  return left*right>0?2*left*right/(left+right):0;
 };
 return a[1]+(b[1]-a[1])*ease(u)+dx*u*(1-u)*((1-u)*slope(i)-u*slope(i+1));
}
const rad=Math.PI/180;
function setYaw(old,yaw){
 const e=new Euler().setFromQuaternion(old,'YXZ');e.y=-yaw*rad;
 return new Quaternion().setFromEuler(e);
}
function turnBody(c,t,p){
 const keys=c.turns,hy=sampleTurn(keys.hip,t),relative=sampleTurn(keys.chest,t)-hy,j=p.j;
 // Keep the independently timed release from winding the rib cage far past
 // the pelvis. The smooth shoulder remains continuous at the transition.
 const twist=Math.abs(relative)<=30?relative:Math.sign(relative)*(30+14*Math.tanh((Math.abs(relative)-30)/14));
 const cy=hy+twist;
 const hip=setYaw(p.hipQ,hy),chest=setYaw(p.trunkQ,cy);
 const hd=hip.clone().multiply(p.hipQ.clone().invert()),cd=chest.clone().multiply(p.trunkQ.clone().invert());
 for(const name of ['chest','neck','head',...['L','R'].flatMap(s=>['shoulder','elbow','wrist','hand'].map(k=>k+s))])
  j[name].sub(j.pelvis).applyQuaternion(cd).add(j.pelvis);
 for(const s of ['R','L']){
  j['hip'+s].sub(j.pelvis).applyQuaternion(hd).add(j.pelvis);
  // Roll on the forefoot as the hips open. The ball of the planted shoe stays in court space.
  const foot=p.feet[s],point=foot.toe.clone().lerp(foot.ankle,.25);
  const heading=new Quaternion().setFromAxisAngle(V(0,1,0),-hy*rad*(s==='R'?.38:.20));
  for(const name of ['ankle','toe','heel','sole','pivot'])foot[name].sub(point).applyQuaternion(heading).add(point);
  foot.q.premultiply(heading);foot.yaw+=hy*(s==='R'?.38:.20);
 }
 p.hipQ=hip;p.trunkQ=chest;p.headQ=setYaw(p.headQ,cy*.38);
}
export function prepare(c){c.track=track(c);c.contact=c.id==='jump-smash'?.54:c.family==='전위'?.52:.57;if(c.swing)c.turns=turnKeys(c);return c;}
function profile(keys,t){
 let i=0;while(i<keys.length-2&&keys[i+1][0]<t)i++;
 const a=keys[i],b=keys[i+1],u=ease(Math.min(1,Math.max(0,(t-a[0])/(b[0]-a[0]))));return mix(a[1],b[1],u);
}
export function pose(c,t,reference){
 const p=evaluatePose(c.track,t,rigLength);if(!c.swing)return p;
 turnBody(c,t,p);
 const [u,f,uc,fc,shaft]=swings[c.swing].map(a=>a.slice()),over=c.family==='후위',net=c.swing==='net',serve=c.family==='서브',def=c.swing==='block',hit=c.contact;
 if(c.back){
  [u,f,uc,fc,shaft].forEach((a,i)=>{a[0]=i===0?.24:-Math.abs(a[0])-(i===3?.25:.10);});
  if(over){u.splice(0,3,.32,.48,-.78);f.splice(0,3,-.87,.32,.28);uc.splice(0,3,-.30,.83,-.46);fc.splice(0,3,-.45,.83,-.30);}
 }
 const across=c.back?1:-1;
 const followU=over?[across*.4,-.38,-.79]:[uc[0]*.9,uc[1]+.07,uc[2]];
 const followF=over?[across*.74,-.60,-.24]:c.swing==='lift'?[across*.22,.76,-.65]:[fc[0]+across*.12,fc[1]+.10*c.style,fc[2]];
 const prepS=over?[.48,.30,.88]:serve?[across*.68,-.73,.06]:[c.back?-.57:.63,.60,.47];
 const followS=over?[across*.45,-.85,-.25]:net?[shaft[0],.35,-.9]:[shaft[0],.84,-.43];
 function limb(start,prep,contact,follow,lag){
  return profile([[0,start],[hit-.24,prep],[hit-.13+lag,prep],[hit+lag*.2,contact],[hit+(net?.125:.14)+lag,follow],[.89,start],[1,start]],t);
 }
 // These arm paths are authored in the chest frame. A rotating shoulder carries
 // the elbow, forearm and shaft; the source photo below is already in court space.
 const upper=limb(ready[0],u,uc,followU,-.038).applyQuaternion(p.trunkQ);
 const fore=limb(ready[1],f,fc,followF,0).applyQuaternion(p.trunkQ);
 // Retain a bounded contribution from the selected source athlete's limb directions near contact.
 if(reference){
  const q=Math.exp(-((t-hit)**2)/.022)*.23;
  for(const [d,a,b] of [[upper,'shoulderR','elbowR'],[fore,'elbowR','wristR']]){
   const v=V(...reference[b]).sub(V(...reference[a])).normalize();
   d.lerp(v,q).normalize();
  }
 }
 const J=p.j;
 J.elbowR=J.shoulderR.clone().addScaledVector(upper,rigLength.upperArm);J.wristR=J.elbowR.clone().addScaledVector(fore,rigLength.forearm);J.handR=J.wristR.clone().addScaledVector(fore,.075);
 if(serve){
  const left=profile([[0,[-.65,-.65,-.4]],[.30,[-.35,-.45,-.82]],[hit,[-.26,-.34,-.91]],[.8,[-.71,-.68,.12]],[1,[-.65,-.65,-.4]]],t);
  J.elbowL=J.shoulderL.clone().addScaledVector(left.applyQuaternion(p.trunkQ),rigLength.upperArm);J.wristL=J.elbowL.clone().addScaledVector(V(.42,.16,-.89).applyQuaternion(p.trunkQ),rigLength.forearm);
 }
 p.racketDir=limb(ready[2],prepS,shaft,followS,.022).applyQuaternion(p.trunkQ);
 p.roll=(c.back?-1:1)*(net?65:def?24:c.swing==='slice'?59:14)+Math.sin(Math.PI*Math.min(1,t/hit))*25;
 return p;
}
