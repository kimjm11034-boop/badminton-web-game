// 월드는 미터 단위의 (x, y, z). y=0은 네트, 플레이어는 y<0에 위치합니다.
export const COURT = { halfWidth: 2.59, halfLength: 6.7, net: 1.524, drag: .22, gravity: 9.81 };
export const DT = 1 / 240;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function integrate(b, dt = DT) {
  // Evaluate gravity and quadratic drag at the midpoint of the step.
  // Forecasts and live play can then use different tick rates with the same flight.
  const half = dt / 2, k = b.drag ?? COURT.drag;
  const initialDrag = k * Math.hypot(b.vx,b.vy,b.vz);
  const mx = b.vx * (1-initialDrag*half), my = b.vy * (1-initialDrag*half);
  const mz = b.vz * (1-initialDrag*half) - COURT.gravity*half;
  const drag = k * Math.hypot(mx,my,mz);
  b.x += mx*dt; b.y += my*dt; b.z += mz*dt;
  b.vx -= drag*mx*dt; b.vy -= drag*my*dt; b.vz -= (COURT.gravity+drag*mz)*dt;
  // Once past the net (dir = travel direction along y) and falling (or at once for an
  // `early` stroke), a stroke's brake damps the forward speed: the shuttle turns over and
  // drops where power and impact sent it.
  if (b.brake && (b.vz < 0 || b.early) && b.y*(b.dir||0) > 0) { const f = 1/(1+b.brake*Math.hypot(b.vx,b.vy)*dt); b.vx *= f; b.vy *= f; }
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
// Stroke shapes (user 2026-11-28). The landing distance past the net comes from power and
// impact (doubles/simulation.js); each stroke keeps its own shape before the net and its
// brake (see integrate) sets where it comes down:
//  smash  - straight and downward, power = pace;     clear - apex 6-8 m, natural flight;
//  drop   - contact is the highest point, skims the tape and dies;
//  drive  - hard and flat; below the tape it rises to 1.55-2.0 m at the net, peaks past it;
//  cut    - slow and controlled; below the tape it rises over the net and turns over
//           0.5-0.7 m past it; above the tape it leaves nearly straight.
function impactFlight(pos,target,type,power,{quality,error}){
  const dx=target.x-pos.x,dy=target.y-pos.y,distance=Math.hypot(dx,dy)||1;
  const side=Math.sign(dy)||1,land=Math.abs(target.y),miss=1-quality;
  const below=pos.z<COURT.net+.05,cut=type==='slice'||type==='block';
  function launch(angle,speed,drag=COURT.drag,brake=0,early=false){
    const radians=angle*Math.PI/180,h=speed*Math.cos(radians);
    return {vx:h*dx/distance,vy:h*dy/distance,vz:speed*Math.sin(radians),speed,angle,drag,brake,early,dir:side};
  }
  // Net-crossing height, highest point and landing, as distances past the net.
  function fly(shot){
    const b={...pos,vx:shot.vx,vy:shot.vy,vz:shot.vz,drag:shot.drag,brake:shot.brake,early:shot.early,dir:side};
    let net=-1,top=b.z,apex=b.y*side;
    for(let i=0;i<840&&b.z>0;i++){
      const y=b.y,z=b.z;integrate(b,1/120);
      if(y*b.y<=0&&y!==b.y)net=z+(b.z-z)*(-y/(b.y-y));
      if(b.z>top){top=b.z;apex=b.y*side;}
    }
    return {net,top,apex,land:b.y*side};
  }
  // Lowest take-off at this pace that crosses the net at height h.
  function angleThrough(speed,drag,h){
    let low=-45,high=75;
    for(let i=0;i<16;i++){const a=(low+high)/2;if(fly(launch(a,speed,drag)).net<h)low=a;else high=a;}
    return high;
  }
  // Brake that brings the stroke down at the landing distance (none if it already falls short).
  function settle(shot){
    if(fly(shot).land<=land)return shot;
    let low=0,high=60;
    for(let i=0;i<18;i++){const k=(low+high)/2;if(fly({...shot,brake:k}).land>land)low=k;else high=k;}
    return {...shot,brake:high};
  }
  // Slowest pace from `from` up to `max` that satisfies ok(speed).
  function slowest(from,max,ok){
    if(ok(from))return from;if(!ok(max))return max;
    let low=from,high=max;for(let i=0;i<14;i++){const v=(low+high)/2;if(ok(v))high=v;else low=v;}
    return high;
  }
  // Flat or slightly downward take-off (contact = highest point) that skims the net at h.
  function skim(h,drag,cap,early=false){
    for(let a=0;a<=40;a+=1){
      if(fly(launch(a,cap,drag)).net<h)continue;
      return launch(a,slowest(1,cap,v=>fly(launch(a,v,drag)).net>=h),drag,0,early);
    }
    return launch(angleThrough(cap,drag,h),cap,drag,0,early);
  }
  if(type==='clear'){
    // Apex 6-8 m by power; natural flight to the landing.
    const height=6+2*power;let low=15,high=80,shot=null;
    for(let i=0;i<16;i++){
      const a=(low+high)/2,v=slowest(3,90,v=>fly(launch(a,v)).land>=land);
      shot=launch(a,v);if(fly(shot).top<height)low=a;else high=a;
    }
    return finish(shot);
  }
  if(type==='drop'){
    const shot=skim(COURT.net+.10+.12*(1-power)+.30*miss,COURT.drag,40);
    return finish(settle(shot));
  }
  if(cut){
    const clean=(type==='slice'?.065:.10)+.10*(1-power);
    // Early contact floats; a late one graded GOOD skims the tape; BAD timing (below) nets.
    const good=judgeTiming(error)!=='BAD';
    let h=COURT.net+(error<0?Math.min(clean+1.12*miss,good?.45:9):error>0&&good?Math.max(.015,clean*(1-miss/.45)):clean);
    let shot;
    // GOOD timing never floats a cut above 2.0 m at the net (user 2026-11-28); from a high
    // contact that leaves no room to climb, so it goes nearly straight instead.
    const climb=good&&pos.z+.25>1.98?false:pos.z<h;
    if(good)h=Math.min(h,1.98);
    if(climb){
      // Struck below the crossing height: a slow, light flight that rises over the net and
      // turns over 0.5-0.7 m past it (the shorter the cut, the sooner). It always climbs a
      // little, which keeps a cut from just under the tape slow instead of flat and fast.
      h=Math.max(h,pos.z+.25);
      const drag=.05,turn=.5+.2*clamp((land-1)/2.5,0,1);
      const v=slowest(3,45,v=>fly(launch(angleThrough(v,drag,h),v,drag)).apex>=turn);
      shot=launch(angleThrough(v,drag,h),v,drag);
    }else shot=skim(h,.05,30,true);   // above it: nearly straight, dies after the net
    shot=settle(shot);
    if(error>0&&!good)shot=launch(shot.angle-12*miss,shot.speed*(1-.16*miss),shot.drag,shot.brake,shot.early);
    return finish(shot);
  }
  if(type==='smash'){
    // One smash: power is pace. Straight and downward; flatter for a deeper landing.
    const pace=70*(.78+.22*clamp((power-.60)/.40,0,1))*(.56+.44*quality);
    // Flattest allowed: level, and over the net below 2.0 m.
    const lowest=angleThrough(pace,COURT.drag,COURT.net+.08),top=Math.max(lowest,Math.min(0,angleThrough(pace,COURT.drag,2.0)));
    let shot;
    if(fly(launch(lowest,pace)).land>=land)shot=launch(lowest,pace);
    else if(fly(launch(top,pace)).land>=land){
      let low=lowest,high=top;
      for(let i=0;i<14;i++){const a=(low+high)/2;if(fly(launch(a,pace)).land<land)low=a;else high=a;}
      shot=launch(high,pace);
    }else{
      // Still short (a deep smash from far back): a cleaner, faster-travelling flight.
      let low=.10,high=COURT.drag;
      for(let i=0;i<12;i++){const d=(low+high)/2;if(fly(launch(top,pace,d)).land<land)high=d;else low=d;}
      shot=launch(top,pace,low);
    }
    // A mistimed smash opens up, but still crosses the net below 2.0 m.
    shot=launch(Math.max(shot.angle,Math.min(shot.angle+7*miss,angleThrough(shot.speed,shot.drag,2.0))),shot.speed,shot.drag);
    return finish(settle(shot));
  }
  // Drive: hard and flat. Up to 55 m/s (198 km/h) a longer drive is struck harder; past that a
  // cleaner, faster-travelling flight carries it instead.
  const pace=(25+17*power)*(.6+.4*quality);
  let make,ok;
  if(below){
    // Rises to the net (1.55-2.0 m, higher when mistimed), peaks past it, then runs on and falls.
    const h=COURT.net+.12+.25*miss,peak=.4+.8*clamp((land-4)/2,0,1);
    make=(v,d)=>launch(angleThrough(v,d,h),v,d);
    ok=shot=>{const f=fly(shot);return f.apex>=peak&&f.land>=land;};
  }else{
    // Above the tape a clean drive leaves flat or downward; a mistimed one opens up.
    const attack=clamp((pos.z-COURT.net-.03)/.45,0,1);
    make=(v,d)=>launch(Math.max(-.6-3.8*power*attack+14*miss,angleThrough(v,d,COURT.net+.11)),v,d);
    ok=shot=>fly(shot).land>=land;
  }
  let shot=make(slowest(pace,Math.max(pace,55),v=>ok(make(v,COURT.drag))),COURT.drag);
  if(!ok(shot)){
    let low=.02,high=COURT.drag;
    for(let i=0;i<12;i++){const d=(low+high)/2;if(ok(make(shot.speed,d)))low=d;else high=d;}
    shot=make(shot.speed,low);
  }
  return finish(settle(shot));
  function finish(shot){return {...shot,prediction:trace({...pos,vx:shot.vx,vy:shot.vy,vz:shot.vz,drag:shot.drag,brake:shot.brake,early:shot.early,dir:side},1/120)};}
}
export function shotVelocity(pos, target, type, power = .7, impact = null) {
  type=({jump:'smash',jumpDrop:'drop',serveShort:'net',serveLong:'lift'})[type]||type;
  if(impact && ['smash','drive','slice','block','drop','clear'].includes(type))
    return impactFlight(pos,target,type,clamp(power,0,1),impact);
  // 같은 항력 적분기로 사전 궤적을 계산합니다. 단순 직선 에임으로 인한 상시 네트/아웃을 방지하며,
  // 도달 거리와 네트 여유를 함께 평가합니다. 파워는 목표 깊이와 출발 속도/각도 선택에 반영합니다.
  const dx=target.x-pos.x,dy=target.y-pos.y,distance=Math.hypot(dx,dy);
  const loft = 34 + 18*clamp(power,0,1);
  const angles={smash:[-22,-16,-12,-8,-4,0],clear:[loft,loft-6,loft-12,26],drive:[-2,0,1,2],drop:[-18,-12,-8,-4,0,4,8,12,16,20,26,32,40],slice:[-8,-4,0],lift:[50,58,65,70],net:[30,40,50,60],push:[-25,-18,-12,-8,-4],block:[8,16,25,35,45]};
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
    const preferred=type==='clear'?loft:type==='lift'?60:type==='drive'?0:type==='push'?-12:20;
    const shape=type==='drop'?Math.abs(clearance-.15)*3:type==='smash'?result.time*5:Math.abs(deg-preferred)*.015;
    const score=error*20+(clearance<.06?100+Math.abs(clearance)*100:0)+shape;
    if(type==='drop' && error<.05 && clearance>=.06 && clearance<=.27)return {...velocity,speed,score,prediction:result,angle:deg};
    if(type==='clear' && error<.05 && clearance>.1)return {...velocity,speed,score,prediction:result,angle:deg};
    if(!best||score<best.score) best={...velocity,speed,score,prediction:result,angle:deg};
  }
  return best;
}
export function groundWinner(ball, lastHit) {
  const inside=Math.abs(ball.x)<=COURT.halfWidth+.02 && Math.abs(ball.y)<=COURT.halfLength+.02;
  return inside ? (ball.y<0?1:0) : 1-lastHit;
}
export function matchWon(scores, target) { return Math.max(...scores)>=target && Math.abs(scores[0]-scores[1])>=2 || Math.max(...scores)>=target+9; }
