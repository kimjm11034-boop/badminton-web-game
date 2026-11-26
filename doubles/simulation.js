import {clamp,integrate,shotVelocity,gestureMetrics,judgeTiming} from '../physics.js';

export const defaults={width:6.10,length:13.40,eye:1.69,pitch:2,fov:72,bird:1.35,arc:1,backArc:1};
export const shotNames={drive:'드라이브',clear:'클리어',drop:'드롭',smash:'스매시',lift:'언더 클리어',block:'수비 커트',slice:'공격 커트',net:'헤어핀',crossNet:'크로스 헤어핀',short:'쇼트 서브',long:'롱 서브'};
const side=id=>id<2?-1:1, team=id=>id>>1;
export function readSwing(points,seconds,height,front){
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
 const force=Math.hypot(g.dx,g.dy)*(.78+.22*clamp(g.speed/600,0,1.6));
 let type='drive';
 if(curve)type=height>=1.6?'slice':'block';
 else if(front&&(tap||horizontal))type=tap?'net':'crossNet';
 else if(!tap&&!horizontal&&g.dy<0)type=height>=1.55?'clear':force>=49?'lift':'block';
 else if(!tap&&!horizontal&&g.dy>0)type=height>=1.58?(force>=67?'smash':'drop'):'block';
 const aim=tap?0:clamp(g.dx/Math.max(35,Math.hypot(g.dx,g.dy)),-1,1)*Math.min(1,.36+g.distance/100);
 return {...g,type,aim,curve};
}
export const contactQuality=error=>.32+.68*Math.exp(-((error/.255)**2));
function player(id){return {id,x:0,y:0,vx:0,vy:0,jump:0,jumpV:0,swing:-10,hand:'fore',shot:'drive'};}
export function createMatch(settings={...defaults},random=Math.random){
 const s={settings,players:Array.from({length:4},(_,i)=>player(i)),phase:'ready',score:[0,0],server:0,receiver:2,
  right:[0,2],time:0,ball:null,rally:0,last:0,serviceFlight:false,plan:null,quality:null,feedback:'',event:0,swings:0};
 const half=()=>settings.width/2,deep=()=>settings.length/2;
 const shortLine=()=>1.98*deep()/6.7,longLine=()=>5.94*deep()/6.7;
 function signal(msg){s.feedback=msg;s.event++;}
 function setup(){
  const serving=team(s.server),rightCourt=s.score[serving]%2===0;
  s.receiver=rightCourt?s.right[1-serving]:(s.right[1-serving]^1);
  for(const p of s.players){
   const servingOrReceiving=p.id===s.server||p.id===s.receiver;
   p.x=(p.id===s.right[team(p.id)]?1:-1)*-side(p.id)*half()*.47;
   p.y=side(p.id)*deep()*(servingOrReceiving?.44:.71);p.vx=p.vy=p.jump=p.jumpV=0;p.swing=p.strikeAt=-10;p.hit=null;
  }
  s.phase='serve';s.deadline=s.time+1.15;s.rally=0;s.quality=null;s.serviceFlight=false;s.plan=null;s.pending=null;
  followServer();signal(s.server===0?'내 서브 · 클릭하면 시작':s.receiver===0?'리시브 준비':s.server===1?'파트너 서브':'상대 서브');
 }
 function followServer(){const p=s.players[s.server];s.ball={x:p.x+.14*-side(p.id),y:p.y-side(p.id)*.94,z:1.10,vx:0,vy:0,vz:0};}
 function start(){s.score=[0,0];s.server=0;s.right=[0,2];s.lastShot=null;setup();}
 function point(winner,why){
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
    const late=Math.max(0,dist-.76-Math.max(0,time-.10)*4.2);
    const c=late*4+dist*.24+Math.abs(b.z-1.8)*.40+time*.19;
    if(c<cost){cost=c;chosen={...b,standX:x,standY:y};}
   }
   return {id:p.id,cost,chosen};
  }).filter(c=>c.chosen).sort((a,b)=>(a.cost-(a.id===0?.24:0))-(b.cost-(b.id===0?.24:0)));
  s.plan=best.length?{actor:best[0].id,target:best[0].chosen,human:best.find(c=>c.id===0)?.chosen}:null;
 }
 function launch(id,type,target,hand,error=0,serve=false){
  const p=s.players[id],b=s.ball;
  const mapped={short:'serveShort',long:'serveLong',crossNet:'net'}[type]||type;
  let v=shotVelocity(b,target,mapped);
  if((v.prediction.netHeight??0)<1.60&&mapped!=='smash'){
   const loft=shotVelocity(b,target,'block');
   if((loft.prediction.netHeight??0)>(v.prediction.netHeight??0))v=loft;
  }
  const stretch=Math.hypot(b.x-p.x,b.y-p.y-.46);
  const quality=id===0&&!serve?contactQuality(error)*(1-.15*clamp((stretch-.50)/.72,0,1)):1;
  const factor=.62+.38*quality;
  Object.assign(b,{vx:v.vx*factor,vy:v.vy*factor,vz:v.vz*factor});
  s.last=id;s.serviceFlight=serve;s.phase='rally';s.rally++;s.quality=id===0&&!serve?quality:null;
  Object.assign(p,{swing:s.time,strikeAt:s.time,shot:type,hand,hit:{x:b.x,y:b.y,z:b.z}});
  s.lastShot={id,type,hand,speed:v.speed*factor*3.6,error,at:s.time};forecast();
  signal((id===0?'나':id===1?'파트너':'상대 '+(id-1))+' · '+shotNames[type]);
 }
 function serve(id,hand='fore',long=false){
  const p=s.players[id],r=s.players[s.receiver],dir=-side(id);
  // Target the diagonal service box even if the human receiver has moved away.
  const rx=Math.sign((s.receiver===s.right[team(r.id)]?1:-1)*-side(r.id));
  const target={x:rx*half()*.45,y:dir*(long?longLine()-.35:shortLine()+.53)};
  s.serviceSign=rx;followServer();launch(id,long?'long':'short',target,hand,0,true);
 }
 function swing(hand,points,seconds){
  if(!['serve','rally'].includes(s.phase)||s.pending)return;
  const p=s.players[0],b=s.ball,g=readSwing(points,seconds,b.z,Math.abs(b.y)<shortLine()&&Math.abs(p.y)<shortLine()+.48);
  p.aim=g.aim;p.cutSign=Math.sign(g.dx)||1;
  if(s.phase==='serve'){if(s.server===0){s.swings++;serve(0,hand,g.dy< -25);}return;}
  p.swing=s.time;p.strikeAt=s.time+.065;p.hand=hand;p.shot=g.type;p.hit=null;s.swings++;
  const projected={...b};for(let i=0;i<8;i++)integrate(projected,.065/8);
  if(team(s.last)===0||s.serviceFlight&&s.receiver!==0||!reachable(p,projected)&&!reachable(p,b)){signal(team(s.last)===0?'상대 코트로 넘어가는 중':s.serviceFlight&&s.receiver!==0?'파트너 리시브':'헛스윙 · 콕 가까이 이동');return;}
  p.hit={x:projected.x,y:projected.y,z:projected.z};
  s.pending={hand,g,at:p.strikeAt,error:p.strikeAt-(s.plan?.human?.at??p.strikeAt)};
 }
 function strike(){
  const {hand,g,error}=s.pending,p=s.players[0],b=s.ball;s.pending=null;
  if(team(s.last)===0||!reachable(p,b)){p.hit=null;signal('헛스윙 · 타점에 닿지 않았습니다');return;}
  let x=b.x+g.aim*half()*1.42;
  if(g.type==='crossNet')x=b.x+Math.sign(g.dx)*half()*(.8+Math.abs(g.aim)*.75);
  const depth={net:.12,crossNet:.16,drop:.21,slice:.25,block:.23,drive:.70,lift:.87,clear:.92,smash:.58}[g.type];
  launch(0,g.type,{x:clamp(x,-half()+.1,half()-.1),y:deep()*depth},hand,error);
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
   move(a,tx,ty,respond?4.4:2.65,dt);
   if(!respond||s.time<s.plan.target.at-.045||!reachable(a,b)||same&&s.pending)continue;
   if(same&&!s.serviceFlight&&reachable(p,b)&&s.time<s.plan.target.at+.18)continue;
   const t=random(),type=b.z>2.0&&t<.26?'smash':Math.abs(b.y)<shortLine()&&t<.38?'net':b.z<1.48?'lift':t<.46?'drive':t<.65?'drop':'clear';
   const humanLane=p.x*.65+(random()-.5)*half()*.88;
   const destX=!same&&random()<.63?humanLane:(random()-.5)*half()*1.65;
   launch(a.id,type,{x:clamp(destX,-half()+.12,half()-.12),y:-dir*deep()*({net:.16,drop:.21,smash:.55,drive:.65,lift:.88,clear:.89}[type])},(b.x-a.x)*-dir<0?'back':'fore');break;
  }
 }
 function resize(w,l){const rx=w/settings.width,ry=l/settings.length;settings.width=w;settings.length=l;
  for(const q of [...s.players,...(s.ball?[s.ball]:[])]){q.x*=rx;q.y*=ry;if('vx' in q){q.vx*=rx;q.vy*=ry;}}
  if(s.phase==='rally')forecast();
 }
 return {s,start,tick,jump,swing,resize,reachable,timing:()=>s.plan?.human?s.time+.065-s.plan.human.at:null,grade:judgeTiming};
}
