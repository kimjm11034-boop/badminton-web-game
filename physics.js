// 월드는 미터 단위의 (x, y, z). y=0은 네트, 플레이어는 y<0에 위치합니다.
export const COURT = { halfWidth: 2.59, halfLength: 6.7, net: 1.524, drag: .25, gravity: 9.8 };
export const DT = 1 / 240;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function integrate(b, dt = DT) {
  // a_drag = -Cd * |v| * v. 고정 시간 간격으로 적분하여 프레임률에 따른 오차를 제한합니다.
  const speed = Math.hypot(b.vx, b.vy, b.vz), drag = COURT.drag * speed;
  b.vx -= drag * b.vx * dt; b.vy -= drag * b.vy * dt;
  b.vz += (-COURT.gravity - drag * b.vz) * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  return b;
}
export function trace(initial, dt = DT, maxTime = 7) {
  const b = { ...initial }; let netHeight = null, apex = b.z, t = 0, intercept = null;
  for (; t < maxTime && b.z > 0; t += dt) {
    const prev = { ...b }; integrate(b, dt); apex = Math.max(apex, b.z);
    if (prev.y * b.y <= 0 && prev.y !== b.y) {
      const f = -prev.y / (b.y - prev.y); netHeight = prev.z + (b.z - prev.z) * f;
    }
    if (!intercept && b.vz < 0 && b.z <= 2.65) intercept = { x:b.x, y:b.y, z:b.z, time:t };
    if (b.z <= 0) {
      const f = prev.z / (prev.z - b.z); b.x = prev.x + (b.x-prev.x)*f; b.y = prev.y + (b.y-prev.y)*f; b.z = 0;
    }
  }
  return { ...b, time:t, netHeight, apex, intercept };
}
export function predictIntercept(ball, side, player = {x:0,y:side*3.2}) {
  const b = { ...ball }; let best = null, bestSlack = -Infinity;
  for (let t = 0; t < 5 && b.z > .12; t += 1/120) {
    integrate(b, 1/120);
    if (b.y*side > .3 && b.vz < 0 && b.z <= 2.7 && b.z > .4) {
      // 첫 교차점이 너무 빠르면 낮은 타점까지 기다립니다. 이동 가능 시간과 라켓 리치를 함께 계산합니다.
      const reachTime=.12+.08+Math.max(0,Math.hypot(b.x-player.x,b.y-player.y)-.85)/4.7;
      const slack=t-reachTime;
      if(slack>bestSlack){best={x:b.x,y:b.y,z:b.z,time:t};bestSlack=slack;}
      if(slack>=0)break;
    }
  }
  return best || {x:clamp(b.x,-2.7,2.7),y:clamp(b.y*side,.5,6.8)*side,z:1,time:1};
}
export function gestureMetrics(points, duration, sensitivity = 1) {
  if (!points.length) return {dx:0,dy:0,distance:0,speed:0,peak:0,duration,power:.25};
  const first=points[0],last=points.at(-1); let distance=0,peak=0;
  for(let i=1;i<points.length;i++) {
    const d=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
    distance+=d; peak=Math.max(peak,d/Math.max(.012,(points[i].t-points[i-1].t)/1000));
  }
  // 마지막 120ms의 손목 가속을 사용. 전체 평균만 쓰면 긴 준비 동작과 빠른 릴리스를 구분할 수 없습니다.
  const recent=points.find(p=>last.t-p.t<=120)||first;
  const speed=Math.hypot(last.x-recent.x,last.y-recent.y)/Math.max(.025,(last.t-recent.t)/1000)*sensitivity;
  return { dx:(last.x-first.x)*sensitivity,dy:(last.y-first.y)*sensitivity,distance:distance*sensitivity,
    speed,peak:peak*sensitivity,duration,power:clamp(.2+speed/2400+distance*sensitivity/650,.18,1) };
}
export const SHOTS = {
  smash:{name:'스매시',label:'SMASH!',icon:'↑',color:'#c3ff7c'},
  clear:{name:'하이 클리어',label:'HIGH CLEAR',icon:'⤴',color:'#a7b5ff'},
  drive:{name:'드라이브',label:'DRIVE',icon:'↑',color:'#8eeaf1'},
  drop:{name:'드롭',label:'DROP SHOT',icon:'↓',color:'#e4c1ff'},
  slice:{name:'슬라이스 드롭',label:'SLICE!',icon:'↔',color:'#f3b5df'},
  lift:{name:'언더 클리어',label:'LIFT',icon:'⤴',color:'#a7b5ff'},
  net:{name:'헤어핀',label:'NET SHOT',icon:'⌒',color:'#e4c1ff'}
};
export function classify(g, z, y, context={}) {
  // 위=수비, 아래=공격. 준비 시간만으로 클리어를 선택하지 않습니다.
  const tap=g.distance<4,up=g.dy < -5&&-g.dy>Math.abs(g.dx)*.28,down=g.dy>3&&g.dy>Math.abs(g.dx)*.28;
  const lateral=Math.abs(g.dx)>6&&!up&&!down;
  if(context.defending){if(tap)return 'block';if(Math.abs(g.dx)>24&&Math.abs(g.dx)>Math.abs(g.dy)*.7)return 'drive';if(up)return 'lift';return down&&z>1.55?'push':'block';}
  if(Math.abs(y)<2.15){if(tap)return 'drive';if(lateral)return 'net';if(up)return 'lift';if(down)return z>1.5?'push':'net';return 'net';}
  if(tap)return 'drive';
  if(up&&!lateral)return z<1.4?'lift':'clear';
  if(down&&!lateral){
    const long=Math.hypot(g.dx,g.dy)>=72;
    if(context.highReturn&&g.duration>=.45&&z>2.4)return long?'jump':'jumpDrop';
    if(z>2.1&&long)return 'smash';
    return z<1.3?'block':'drop';
  }
  return 'drive';
}
export function timingRadius(error){return clamp(20+error*22,2,34);}
export function judgeTiming(error){
 const difference=Math.abs(timingRadius(error)-20);
 return difference<=1.8?'PERFECT':difference<=5.5?'GOOD':'BAD';
}
export function predictContactTime(ball,side,height=2.15){
 const b={...ball};for(let t=0;t<6&&b.z>0;t+=DT){if(b.y*side>.2&&b.vz<0&&b.z<=height)return t;integrate(b,DT);}return 0;
}
Object.assign(SHOTS,{
 jumpDrop:{name:'점프 드롭',label:'JUMP DROP',icon:'↙',color:'#c8dcff'},
 jump:{name:'점프 스매시',label:'JUMP SMASH!',icon:'↓',color:'#ffcb77'},
 push:{name:'푸시',label:'PUSH',icon:'↓',color:'#9eedd3'},
 block:{name:'수비 커트 / 블록',label:'SOFT BLOCK',icon:'·',color:'#c3e2ff'}
});
// 커서의 절대 위치는 사용하지 않습니다. 직선은 접촉점 x, 사선의 수평/수직 비율은 코스를 정합니다.
export function strokeTarget(g,pos,type){
 const ratio=g.distance<4?0:clamp(g.dx/Math.max(8,Math.abs(g.dy)),-1.5,1.5);
 const power=g.power??.5;
 const depth=['drop','jumpDrop','net','block'].includes(type)?.7+power*.85:
   ['smash','jump'].includes(type)?2.1+power*1.8:['drive','push'].includes(type)?3.3+power*1.7:5+power*.9;
 return {x:clamp(pos.x+ratio*2.1,-2.3,2.3),y:depth};
}
export function serviceTarget(g,layout){
 const long=g.duration>=.35,ratio=clamp((g.dx||0)/100,-1,1),sign=Math.sign(layout.receiver.x);
 const depth=(long?5.9:2.35)+clamp(-(g.dy||0)/160,-1,1)*(long?.3:.2);
 return {x:clamp(layout.receiver.x+ratio*.85,sign>0?.25:-2.3,sign>0?2.3:-.25),y:-layout.side*depth,type:long?'serveLong':'serveShort'};
}
export function serviceLayout(server,points){
 const side=server===0?-1:1,x=(points%2?-1:1)*-side*1.25;
 return {serverIndex:server,side,parity:points%2?'LEFT':'RIGHT',server:{x,y:side*3.1},receiver:{x:-x,y:-side*4.2}};
}
export function validServiceLanding(ball,layout){return ball.y*layout.side<=-1.98&&ball.y*layout.side>=-6.72&&ball.x*layout.receiver.x>=0&&Math.abs(ball.x)<=2.61;}
export function shotVelocity(pos, target, type, power = .7) {
  type=({jump:'smash',jumpDrop:'drop',serveShort:'net',serveLong:'lift'})[type]||type;
  // 같은 항력 적분기로 사전 궤적을 계산합니다. 단순 직선 에임으로 인한 상시 네트/아웃을 방지하며,
  // 도달 거리와 네트 여유를 함께 평가합니다. 파워는 목표 깊이와 출발 속도/각도 선택에 반영합니다.
  const dx=target.x-pos.x,dy=target.y-pos.y,distance=Math.hypot(dx,dy);
  const angles={smash:[-22,-16,-12,-8,-4,0],clear:[48,54,60,65],drive:[-2,0,1,2],drop:[-12,-8,-4,0],slice:[-8,-4,0],lift:[50,58,65,70],net:[30,40,50,60],push:[-25,-18,-12,-8,-4],block:[8,16,25,35,45]};
  let best=null;
  for(const deg of angles[type]||angles.clear) {
    const angle=deg*Math.PI/180; let lo=2,hi=type==='smash'?83:75;
    for(let j=0;j<13;j++) {
      const speed=(lo+hi)/2,h=Math.cos(angle)*speed;
      const result=trace({...pos,vx:dx/distance*h,vy:dy/distance*h,vz:Math.sin(angle)*speed},1/120);
      const range=Math.hypot(result.x-pos.x,result.y-pos.y);
      if(range<distance)lo=speed;else hi=speed;
    }
    const speed=(lo+hi)/2,h=Math.cos(angle)*speed;
    const velocity={vx:dx/distance*h,vy:dy/distance*h,vz:Math.sin(angle)*speed};
    const result=trace({...pos,...velocity});
    const clearance=(result.netHeight??-10)-COURT.net;
    const error=Math.hypot(result.x-target.x,result.y-target.y);
    const preferred=type==='clear'?55:type==='lift'?60:type==='drive'?0:type==='push'?-12:type==='drop'?-4:20;
    const score=error*20+(clearance<.10?100+Math.abs(clearance)*100:0)+(type==='smash'?result.time*5:Math.abs(deg-preferred)*.015);
    if(!best||score<best.score) best={...velocity,speed,score,prediction:result,angle:deg};
  }
  return best;
}
export function groundWinner(ball, lastHit) {
  const inside=Math.abs(ball.x)<=COURT.halfWidth+.02 && Math.abs(ball.y)<=COURT.halfLength+.02;
  return inside ? (ball.y<0?1:0) : 1-lastHit;
}
export function matchWon(scores, target) { return Math.max(...scores)>=target && Math.abs(scores[0]-scores[1])>=2 || Math.max(...scores)>=target+9; }
