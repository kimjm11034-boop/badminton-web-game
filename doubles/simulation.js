import {COURT,clamp,integrate,shotVelocity,gestureMetrics,judgeTiming} from '../physics.js';
import {tiers} from './ranks.js';

export const defaults={width:6.10,length:13.40,eye:1.69,pitch:2,fov:72,bird:1.35,arc:1,backArc:1,sensitivity:1,swingLook:.30,volume:.8};
export const shotNames={drive:'드라이브',clear:'클리어',drop:'드롭',smash:'스매시',lift:'언더 클리어',block:'수비 커트',slice:'공격 커트',net:'헤어핀',crossNet:'크로스 헤어핀',short:'쇼트 서브',long:'롱 서브'};
const side=id=>id<2?-1:1, team=id=>id>>1;
export const overheadHeight=1.55;
export const smashThreshold=.60;
// Contact-height bands (user 2026-11-28): smash 2.0-2.5 m; drive and attacking cut 1.25-2.0 m.
// Below 1.25 m a curved swing is a defensive cut. Between 1.55 and 2.0 m a hard downward
// swing is a flat attacking drive, not a smash.
export const smashHeight=2.0;
export const attackCutHeight=1.25;
// `release` is the shuttle height when the swing is released: a smash swung at a shuttle at or
// above 2.0 m stays a smash even if it has dropped a little by the contact (user 2026-11-28).
export function readSwing(points,seconds,height,front,release=height){
 const g=gestureMetrics(points,seconds);
 let turn=0,absolute=0,maxTurn=0,bends=0,prev=null,angle=null,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const p of points){
  minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
  if(prev){const x=p.x-prev.x,y=p.y-prev.y;if(Math.hypot(x,y)<3)continue;
   const a=Math.atan2(y,x);if(angle!==null){const d=Math.atan2(Math.sin(a-angle),Math.cos(a-angle));turn+=d;absolute+=Math.abs(d);maxTurn=Math.max(maxTurn,Math.abs(d));if(Math.abs(d)>.035)bends++;}angle=a;}
  prev=p;
 }
 const curve=g.distance>32&&maxX-minX>12&&maxY-minY>10&&bends>=3&&maxTurn<1.28&&Math.abs(turn)>1.85&&Math.abs(turn)>.68*absolute&&g.distance>1.16*Math.hypot(g.dx,g.dy);
 const tap=g.distance<9, horizontal=Math.abs(g.dx)>Math.abs(g.dy)*2.8;
 const power=clamp((curve?g.distance*2/Math.PI:Math.hypot(g.dx,g.dy))/120,0,1);
 let type='drive';
 if(curve)type=height>=attackCutHeight?'slice':'block';
 else if(front&&(tap||horizontal))type=tap?'net':'crossNet';
 else if(!tap&&!horizontal&&g.dy<0)type=height>=overheadHeight?'clear':power>=.40?'lift':'block';
 else if(!tap&&!horizontal&&g.dy>0)type=height>=overheadHeight?(power>=smashThreshold?(Math.max(height,release)>=smashHeight?'smash':'drive'):'drop'):'block';
 const aim=tap?0:clamp(g.dx/Math.max(35,Math.hypot(g.dx,g.dy)),-1,1)*Math.min(1,.36+g.distance/100);
 return {...g,type,aim,curve,power};
}
export const contactQuality=error=>.32+.68*Math.exp(-((error/.255)**2));
function player(id){return {id,x:0,y:0,vx:0,vy:0,jump:0,jumpV:0,swing:-10,hand:'fore',shot:'drive'};}
export function createMatch(settings={...defaults},random=Math.random,practice=false){
 const s={settings,players:Array.from({length:4},(_,i)=>player(i)),phase:'ready',score:[0,0],server:0,receiver:2,
  right:[0,2],time:0,ball:null,rally:0,last:0,serviceFlight:false,plan:null,quality:null,feedback:'',event:0,swings:0};
 const half=()=>settings.width/2,deep=()=>settings.length/2;
 const shortLine=()=>1.98*deep()/6.7,longLine=()=>5.94*deep()/6.7;
 function signal(msg){s.feedback=msg;s.event++;}
 function setup(){
  if(practice){s.server=2;s.right=[0,2];}
  const serving=team(s.server),rightCourt=s.score[serving]%2===0;
  s.receiver=rightCourt?s.right[1-serving]:(s.right[1-serving]^1);
  for(const p of s.players){
   const servingOrReceiving=p.id===s.server||p.id===s.receiver;
   p.x=(p.id===s.right[team(p.id)]?1:-1)*-side(p.id)*half()*.47;
   p.y=side(p.id)*deep()*(servingOrReceiving?.44:.71);p.vx=p.vy=p.jump=p.jumpV=0;p.swing=p.strikeAt=-10;p.hit=null;
  }
  s.phase='serve';s.deadline=s.time+(s.server>=2?3.5:1.15);s.rally=0;s.quality=null;s.serviceFlight=false;s.plan=null;s.pending=null;
  followServer();signal(s.server===0?'내 서브 · 클릭하면 시작':s.receiver===0?'리시브 준비':s.server===1?'파트너 서브':'상대 서브');
 }
 function followServer(){const p=s.players[s.server];s.ball={x:p.x+.14*-side(p.id),y:p.y-side(p.id)*.94,z:1.10,vx:0,vy:0,vz:0};}
 let opponent=null;
 function start(rank=null){opponent=tiers[rank]??null;s.rank=opponent&&!practice?rank:null;s.score=[0,0];s.server=0;s.right=[0,2];s.lastShot=null;setup();}
 function point(winner,why){
  if(practice){
   s.phase='point';s.deadline=s.time+1.25;s.plan=null;s.ball=null;s.pending=null;
   signal('다음 리시브 준비 · '+why);return;
  }
  s.score[winner]++;const serving=team(s.server);
  if(winner===serving)s.right[winner]^=1;
  else s.server=s.score[winner]%2===0?s.right[winner]:(s.right[winner]^1);
  s.phase=(s.score[winner]>=21&&s.score[winner]-s.score[1-winner]>=2)||s.score[winner]>=30?'over':'point';
  signal((winner?'상대 득점':'우리 팀 득점')+' · '+why);s.deadline=s.time+1.25;s.plan=null;s.ball=null;s.pending=null;
 }
 function reachable(p,b){
  return side(p.id)*b.y>.04&&b.z>.12+p.jump*.55&&b.z<2.54+p.jump&&Math.hypot(b.x-p.x,(b.y-p.y)*1.05)<1.23&&side(p.id)*(b.y-p.y)<.43;
 }
 function forecast(){
  const b={...s.ball},receiving=1-team(s.last),options=[];
  for(let t=0;t<5&&b.z>.08;t+=1/80){
   integrate(b,1/80);
   if(b.y*(receiving?1:-1)<.20||b.z>2.52)continue;
   options.push({x:b.x,y:b.y,z:b.z,at:s.time+t+1/80});
  }
  const candidates=s.players.filter(p=>team(p.id)===receiving&&(!s.serviceFlight||p.id===s.receiver));
  const best=candidates.map(p=>{
   let cost=Infinity,chosen=null;
   for(const b of options){
    const x=clamp(b.x,-half()-.25,half()+.25),y=side(p.id)*clamp(side(p.id)*b.y+.48,.34,deep()+.38);
    const dist=Math.hypot(x-p.x,y-p.y),time=b.at-s.time;
    const skill=p.id>=2?opponent:null;
    const late=Math.max(0,dist-.76-Math.max(0,time-(skill?.reaction??.10))*(skill?.speed??4.2));
    const c=late*4+dist*.24+Math.abs(b.z-1.8)*.40+time*.19;
    if(c<cost){cost=c;chosen={...b,standX:x,standY:y};}
   }
   return {id:p.id,cost,chosen};
  }).filter(c=>c.chosen).sort((a,b)=>(a.cost-(a.id===0?.24:0))-(b.cost-(b.id===0?.24:0)));
  s.plan=best.length?{actor:best[0].id,target:best[0].chosen,human:best.find(c=>c.id===0)?.chosen}:null;
  if(s.plan && s.plan.actor>=2 && opponent){
   s.plan.moveAt=s.time+opponent.reaction;
   s.plan.miss=random()<opponent.miss;
  }
 }
 function launch(id,type,target,hand,error=0,serve=false,power=.7){
  const p=s.players[id],b=s.ball;
  const mapped={short:'serveShort',long:'serveLong',crossNet:'net'}[type]||type;
  const stretch=Math.hypot(b.x-p.x,b.y-p.y-.46);
  const quality=id===0&&!serve?contactQuality(error)*(1-.15*clamp((stretch-.50)/.72,0,1)):1;
  // Shorten the intended landing before solving. Scaling a solved drop velocity
  // afterwards destroys the clearance it was selected for.
  const shaped=['drive','smash','slice','block','drop','clear'].includes(mapped);
  const targetWithTiming=shaped?target:{x:target.x,y:target.y*(.70+.30*quality)};
  const origin={...b,drag:COURT.drag};
  let v=shotVelocity(origin,targetWithTiming,mapped,shaped?power:power*quality,shaped?{quality,error}:null);
  if(!shaped&&(v.prediction.netHeight??0)<1.58&&mapped!=='drop'){
   const loft=shotVelocity(origin,targetWithTiming,'block');
   if((loft.prediction.netHeight??0)>(v.prediction.netHeight??0))v=loft;
  }
  Object.assign(b,{vx:v.vx,vy:v.vy,vz:v.vz,drag:v.drag??COURT.drag,brake:v.brake??0,early:v.early??false,dir:v.dir??0});
  s.last=id;s.serviceFlight=serve;s.phase='rally';s.rally++;s.quality=id===0&&!serve?quality:null;
  Object.assign(p,{swing:s.time,strikeAt:s.time,shot:type,hand,hit:{x:b.x,y:b.y,z:b.z}});
  s.lastShot={id,type,hand,power,speed:v.speed*3.6,angle:v.angle,error,at:s.time};forecast();
  signal((id===0?'나':id===1?'파트너':'상대 '+(id-1))+' · '+shotNames[type]);
 }
 function serve(id,hand='fore',long=false,power=.7){
  const p=s.players[id],r=s.players[s.receiver],dir=-side(id);
  // Target the diagonal service box even if the human receiver has moved away.
  const rx=Math.sign((s.receiver===s.right[team(r.id)]?1:-1)*-side(r.id));
  const target={x:rx*half()*.45,y:dir*(long?longLine()-(1-power)*1.25-.1:shortLine()+.32+power*.55)};
  s.serviceSign=rx;followServer();launch(id,long?'long':'short',target,hand,0,true,power);
 }
 function contactPoint(){
  const b={...s.ball};
  for(let i=0;i<8;i++)integrate(b,.065/8);
  return b;
 }
 function preview(points,seconds,projected){
  const b=s.ball,p=s.players[0];
  if(!b)return null;
  const contact=projected??(s.phase==='rally'?contactPoint():b);
  const g=readSwing(points,seconds,contact.z,Math.abs(contact.y)<shortLine()&&Math.abs(p.y)<shortLine()+.48,b.z);
  if(s.phase==='serve')g.type=g.dy< -25?'long':'short';
  return g;
 }
 function swing(hand,points,seconds){
  if(!['serve','rally'].includes(s.phase)||s.pending)return;
  const p=s.players[0],b=s.ball,projected=s.phase==='rally'?contactPoint():b,g=preview(points,seconds,projected);
  p.aim=g.aim;p.cutSign=Math.sign(g.dx)||1;
  if(s.phase==='serve'){if(s.server===0){s.swings++;serve(0,hand,g.type==='long',g.power);}return;}
  p.swing=s.time;p.strikeAt=s.time+.065;p.hand=hand;p.shot=g.type;p.hit=null;s.swings++;
  if(team(s.last)===0||s.serviceFlight&&s.receiver!==0||!reachable(p,projected)&&!reachable(p,b)){signal(team(s.last)===0?'상대 코트로 넘어가는 중':s.serviceFlight&&s.receiver!==0?'파트너 리시브':'헛스윙 · 콕 가까이 이동');return;}
  p.hit={x:projected.x,y:projected.y,z:projected.z};
  s.pending={hand,g,at:p.strikeAt,error:p.strikeAt-(s.plan?.human?.at??p.strikeAt)};
 }
 function strike(){
  const {hand,g,error}=s.pending,p=s.players[0],b=s.ball;s.pending=null;
  if(team(s.last)===0||!reachable(p,b)){p.hit=null;signal('헛스윙 · 타점에 닿지 않았습니다');return;}
  let x=b.x+g.aim*half()*1.42;
  if(g.type==='crossNet')x=b.x+Math.sign(g.dx)*half()*(.8+Math.abs(g.aim)*.75);
  const power=g.power;
  // Landing past the net (user 2026-11-28), in metres on a 6.7 m half court. Power and a clean
  // impact spread every stroke over its whole range from any contact position:
  // smash / clear 4-6, drop 1-2, drive 3-6 (4-6 from below the tape), attacking cut 1-3.5,
  // defensive cut 1-3. A weak or mistimed stroke lands at the short end.
  const impact=.35+.65*clamp((contactQuality(error)-.58)/.42,0,1);
  const span=(near,far,amount)=>(near+(far-near)*clamp(amount,0,1)*impact)/6.7;
  const depth={net:.11+.10*power,crossNet:.12+.12*power,lift:.57+.38*power,
   smash:span(4,6,(power-smashThreshold)/(1-smashThreshold)),clear:span(4,6,power),drop:span(1,2,power/smashThreshold),
   drive:span(b.z<COURT.net+.05?4:3,6,power),
   // The smallest semicircle the game reads as a cut is about 20% power.
   slice:span(1,3.5,(power-.2)/.8),block:span(1,3,(power-.2)/.8)}[g.type];
  launch(0,g.type,{x:clamp(x,-half()+.1,half()-.1),y:deep()*depth},hand,error,false,power);
 }
 function move(p,x,y,speed,dt){
  const dx=x-p.x,dy=y-p.y,n=Math.hypot(dx,dy),step=Math.min(n,speed*dt);
  p.vx=n>1e-5?dx/n*step/dt:0;p.vy=n>1e-5?dy/n*step/dt:0;p.x+=p.vx*dt;p.y+=p.vy*dt;
 }
 function jump(){const p=s.players[0];if(['serve','rally'].includes(s.phase)&&p.jump<=0)p.jumpV=3.65;}
 function tick(dt,input={}){
  if(s.phase==='ready'||s.phase==='over')return;s.time+=dt;
  if(s.phase==='point'){if(s.time>=s.deadline)setup();return;}
  const p=s.players[0],dx=input.x||0,dy=input.y||0,n=Math.max(1,Math.hypot(dx,dy));
  let x=clamp(p.x+dx/n*4.65*dt,-half()-.36,half()+.36),y=clamp(p.y+dy/n*4.65*dt,-deep()-.43,-.35);
  if(s.phase==='serve'&&s.server===0){const sign=s.right[0]===0?1:-1;x=sign*clamp(sign*x,.15,half()-.05);y=clamp(y,-longLine(),-shortLine()-.35);}
  move(p,x,y,5,dt);p.jumpV-=9.81*dt;p.jump=Math.max(0,p.jump+p.jumpV*dt);if(!p.jump)p.jumpV=0;
  if(s.phase==='serve'){followServer();if(s.server!==0&&s.time>s.deadline)serve(s.server,'back',random()<.28);return;}
  const b=s.ball,old={...b};integrate(b,dt);
  if(old.y*b.y<=0&&old.y!==b.y){const u=old.y/(old.y-b.y);if(old.z+(b.z-old.z)*u<1.524){point(1-team(s.last),'네트');return;}}
  if(b.z<=0){
   const k=old.z/(old.z-b.z),lx=old.x+(b.x-old.x)*k,ly=old.y+(b.y-old.y)*k;
   const legal=Math.abs(lx)<=half()+.02&&Math.abs(ly)<=deep()+.02&&ly*side(s.last)<0&&(!s.serviceFlight||(lx*s.serviceSign>=-.02&&Math.abs(ly)>=shortLine()-.02&&Math.abs(ly)<=longLine()+.02));
   point(legal?team(s.last):1-team(s.last),legal?'코트 안 착지':'아웃');return;
  }
  if(s.pending&&s.time>=s.pending.at){strike();if(s.last===0)return;}
  for(const a of s.players.slice(1)){
   const same=team(a.id)===0,dir=side(a.id),other=s.players[a.id^1],respond=s.plan?.actor===a.id;
   const tx=respond?s.plan.target.standX:clamp(-other.x*.72+(other.x>0?-.38:.38),-half()*.78,half()*.78);
   const ty=respond?s.plan.target.standY:dir*deep()*(Math.abs(other.y)<deep()*.49?.73:.39);
   const skill=same?null:opponent;
   const moving=!(respond&&s.time<s.plan.moveAt);
   move(a,tx,ty,moving?(respond?(skill?.speed??4.4):(skill?.speed??4.4)*.60):0,dt);
   if(!respond||s.time<s.plan.target.at-.045||!reachable(a,b)||same&&s.pending)continue;
   if(s.plan.miss)continue;
   if(same&&!s.serviceFlight&&reachable(p,b)&&s.time<s.plan.target.at+.18)continue;
   const t=random(),underAttack=s.lastShot?.type==='smash';
   let type=b.z>2.0&&t<(skill?.attack??.26)?'smash':Math.abs(b.y)<shortLine()&&t<.38?'net':b.z<1.48?'lift':t<.46?'drive':t<.65?'drop':'clear';
   if(underAttack&&b.z<overheadHeight&&t<.55)type='block';
   else if(type==='drop'&&b.z>=overheadHeight&&Math.abs(b.y)>=shortLine())type='slice';
   const humanLane=p.x*.65+(random()-.5)*half()*.88;
   let destX=!same&&random()<.63?humanLane:(random()-.5)*half()*1.65;
   if(skill){
    if(random()<skill.placement){
     const edges=[-half()+.24,0,half()-.24];
     const gap=x=>Math.min(...s.players.slice(0,2).map(q=>Math.hypot(x-q.x,(-deep()*.65-q.y)*.40)));
     destX=edges.reduce((best,x)=>gap(x)>gap(best)?x:best);
    }else destX=destX*skill.placement+p.x*(1-skill.placement);
   }
   const cpuPower=type==='smash'?.62+.37*(skill?.attack??.35):.40+.47*(skill?.placement??.5);
   const depth={net:.16,drop:.21,smash:.83,drive:.65,lift:.88,clear:.89,block:.24,slice:.30}[type];
   launch(a.id,type,{x:clamp(destX,-half()+.12,half()-.12),y:-dir*deep()*depth},(b.x-a.x)*-dir<0?'back':'fore',0,false,cpuPower);break;
  }
 }
 function resize(w,l){const rx=w/settings.width,ry=l/settings.length;settings.width=w;settings.length=l;
  for(const q of [...s.players,...(s.ball?[s.ball]:[])]){q.x*=rx;q.y*=ry;if('vx' in q){q.vx*=rx;q.vy*=ry;}}
  if(s.phase==='rally')forecast();
 }
 return {s,start,tick,jump,swing,preview,resize,reachable,timing:()=>s.plan?.human?s.time+.065-s.plan.human.at:null,grade:judgeTiming};
}
