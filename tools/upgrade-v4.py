from pathlib import Path
p=Path('game.js');s=p.read_text(encoding='utf-8')
s=s.replace('validServiceLanding}', 'validServiceLanding,strokeTarget,serviceTarget}')
s="import {buildPose,updateMotion} from './motion.js';\n"+s
s=s.replace('let aim=0,aimDepth=.5,','let ')
s=s.replace('cameraY=.4','cameraY=.44')
s=s.replace("{x:1.0,y:-17.8,z:10.8}:{x:8,y:-17.8,z:13.8}","{x:0,y:-24,z:12}:{x:7,y:-24,z:13}")
s=s.replace('tz=.5-cam.z','tz=.7-cam.z').replace('Math.min(W*1.22,H*1.82)','Math.min(W*1.8,H*3.2)').replace('x:W*.53','x:W*.5').replace('clamp(H*.4,','clamp(H*.44,')
s=s.replace('  official(4.05,0,.43,false);\n  for(const xx of [-2.59,2.59])official(xx,9,.4,false);\n','')
a=s.index('function drawPlayer(');b=s.index('function drawAim()',a)
s=s[:a]+'''// 원근 투영된 3D 관절 좌표에 음영 캡슐을 입혀 팔/다리의 부피와 회전을 표현합니다.
function bodySegment(a,b,radius,color,highlight){
  const pa=project(...a),pb=project(...b),dx=pb.x-pa.x,dy=pb.y-pa.y,len=Math.hypot(dx,dy)||1;
  const width=radius*(pa.s+pb.s),nx=-dy/len*width*.45,ny=dx/len*width*.45;
  const grad=ctx.createLinearGradient(pa.x-nx,pa.y-ny,pa.x+nx,pa.y+ny);grad.addColorStop(0,color);grad.addColorStop(.45,highlight||color);grad.addColorStop(1,color);
  ctx.strokeStyle=grad;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();
}
function drawPlayer(p,index){
  const charging=index===0&&hold?clamp((performance.now()-hold.start)/850,0,1):0;
  const jump=index===0?Math.sin(clamp((jumpUntil-simTime)/.6,0,1)*Math.PI)*.65:0;
  const pose=buildPose(p,simTime,{charge:charging,jump}),j=pose.joints;
  ellipse(p.x,p.y,0,.39,.13,'#0c271d66');
  if(index===0){const q=project(p.x,p.y,.025);ctx.strokeStyle=pending?'#e1ffabb0':'#d7f3cf50';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(q.x,q.y,.43*q.s,.14*q.s,0,0,Math.PI*2);ctx.stroke();}
  const skin='#967566',light='#dcc0a5',jersey=index===0?'#d4e3e3':'#23404f',shirtLight=index===0?'#faf7ee':'#3b7586',shorts=index===0?'#a93633':'#1b2a3c';
  for(const side of (p.side===-1?['L','R']:['R','L'])){
    const hip=j['hip'+side],knee=j['knee'+side],ankle=j['ankle'+side],toe=j['toe'+side];
    bodySegment(hip,knee,.092,skin,light);bodySegment(hip,hip.map((v,i)=>v+(knee[i]-v)*.44),.118,shorts,index===0?'#d75443':'#2c4660');
    bodySegment(knee,ankle,.066,skin,light);
    const sock=ankle.map((v,i)=>v+(knee[i]-v)*.25);bodySegment(sock,ankle,.07,'#b7c8cb','#f2f7ee');
    bodySegment(ankle,toe,.085,'#acc0c4','#ffffff');
    const sole=toe.map((v,i)=>i===2?v-.035:v);bodySegment([ankle[0],ankle[1],ankle[2]-.035],sole,.08,'#203e42','#4e8589');
  }
  bodySegment(j.shoulderL,j.elbowL,.056,skin,light);bodySegment(j.elbowL,j.wristL,.047,skin,light);
  const torso=[j.hipL,j.hipR,j.shoulderR,j.shoulderL];polygon(torso,jersey,'#172c3444',1);
  const inset=torso.map(v=>[v[0]-.035,v[1]-.06,v[2]]);polygon([inset[0],inset[1],inset[2]],shirtLight);
  bodySegment(j.shoulderL,j.shoulderR,.085,jersey,shirtLight);
  bodySegment(j.pelvis,j.neck,.13,jersey,shirtLight);
  const bandL=j.shoulderL.map((v,i)=>v+(j.hipL[i]-v)*.32),bandR=j.shoulderR.map((v,i)=>v+(j.hipR[i]-v)*.32);line([bandL,bandR],index===0?'#315b63':'#7dd1cf',2);
  bodySegment(j.shoulderR,j.elbowR,.057,skin,light);bodySegment(j.elbowR,j.wristR,.046,skin,light);
  bodySegment(j.neck,j.head,.075,skin,light);
  const h=project(...j.head),rr=.12*h.s;
  const shade=ctx.createRadialGradient(h.x-rr*.4,h.y-rr*.35,0,h.x,h.y,rr*1.2);shade.addColorStop(0,'#ebcdb0');shade.addColorStop(1,'#977767');ctx.fillStyle=shade;ctx.beginPath();ctx.ellipse(h.x,h.y,rr,rr*1.22,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#202328';ctx.beginPath();ctx.ellipse(h.x,h.y-rr*.5,rr*1.04,rr*.83,pose.yaw*.3,Math.PI,Math.PI*2);ctx.fill();
  if(index===0){ctx.beginPath();ctx.ellipse(h.x,h.y-rr*.18,rr,rr*.9,0,0,Math.PI*2);ctx.fill();}
  else{ctx.fillStyle='#302d2b';ctx.fillRect(h.x-rr*.45,h.y,rr*.16,rr*.09);ctx.fillRect(h.x+rr*.3,h.y,rr*.16,rr*.09);}
  drawRacket(pose.racket,index);
}
function drawRacket(r,index){
  // 참고 라켓의 긴 샤프트, 얇은 청록 프레임, 아이소메트릭 헤드와 흰 오버그립을 3D 형상으로 구성합니다.
  const d=r.direction,g=r.grip,at=t=>g.map((v,i)=>v+d[i]*t),cross=[1,0,-d[0]/Math.max(.15,Math.abs(d[2]))],cl=Math.hypot(...cross),right=cross.map(v=>v/cl);
  bodySegment(at(-.04),at(.105),.021,'#97adaf','#f4f4eb');
  for(let t=-.03;t<.1;t+=.018)line([at(t),at(t+.003)],'#54797b',.65);
  bodySegment(at(.1),at(.43),.009,'#0d2534','#48aebd');
  const center=at(.535),point=(x,y)=>center.map((v,i)=>v+right[i]*x+d[i]*y);
  const ring=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;ring.push(point(Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**.88*.112,Math.sin(a)*.147));}
  line(ring,'#0e202d',3);line(ring,index===0?'#39c5ce':'#62b9db',1.2);
  for(let i=-4;i<=4;i++){
    const x=i*.022,extent=.137*Math.sqrt(Math.max(0,1-(x/.113)**2));line([point(x,-extent),point(x,extent)],'#e4ece8bb',.55);
    const y=i*.029,width=.106*Math.sqrt(Math.max(0,1-(y/.148)**2));line([point(-width,y),point(width,y)],'#e4ece8bb',.55);
  }
  for(const side of [-1,1])line([point(side*.09,-.075),point(side*.108,-.015)],'#c6df60',1.4);
}
''' +s[b:]
a=s.index('function drawAim()');b=s.index('function drawBall()',a)
s=s[:a]+'''function drawAim(){
  if(!hold||!ball)return;
  const g=gestureMetrics(hold.points,(performance.now()-hold.start)/1000,Number(ui.sensitivity.value));
  const type=classify(g,ball.z,ball.y,swingContext());
  const target=phase==='service'?serviceTarget(g,service):strokeTarget(g,ball,type),q=project(target.x,target.y,.04);
  ctx.save();ctx.setLineDash([3,6]);line([[ball.x,ball.y,.04],[target.x,target.y,.04]],'#e6f9ce66',1);ctx.restore();
  ctx.strokeStyle='#d0f69eaa';ctx.beginPath();ctx.ellipse(q.x,q.y,.18*q.s,.065*q.s,0,0,Math.PI*2);ctx.stroke();
}
''' +s[b:]
s=s.replace('Object.assign(p,spot,{vx:0,vy:0,target:null})','Object.assign(p,spot,{vx:0,vy:0,target:null,motion:null})')
s=s.replace('function deliverService(){','function deliverService(metrics={dx:0,dy:0,duration:.6}){')
s=s.replace("  const v=shotVelocity(ball,service.receiver,'lift');", "  const target=serviceTarget(metrics,service);const v=shotVelocity(ball,target,target.type);")
s=s.replace("players[serverIndex].shotType='lift';", "players[serverIndex].shotType=target.type;")
s=s.replace("announce('SERVICE',", "announce(target.type==='serveShort'?'SHORT SERVICE':'LONG SERVICE',")
s=s.replace('function setAim(p){aim=clamp((p.x/W-.5)*6,-2.25,2.25);aimDepth=clamp(1-p.y/H,0,1);}', '')
s=s.replace('setAim(p);','')
s=s.replace('deliverService();return;', 'deliverService(metrics);return;')
s=s.replace("if(classify(metrics,ball.z,ball.y,swingContext())==='jump')", "if(['jump','jumpDrop'].includes(classify(metrics,ball.z,ball.y,swingContext())))")
s=s.replace('pending={metrics,aim,depth:aimDepth,expires:', 'pending={metrics,expires:')
s=s.replace("ball.z<3.2+jumpReach", "ball.z<2.8+jumpReach")
s=s.replace("const type=classify(g,ball?.z||2.4,ball?.y||players[0].y,swingContext()),s=SHOTS[type];", "const type=classify(g,ball?.z||2.4,ball?.y||players[0].y,swingContext()),s=SHOTS[type];")
# hit target absolute cursor removal
a=s.index('  if(!pending||!canHit(0))return;const g=');b=s.index('  const height=',a)
s=s[:a]+'''  if(!pending||!canHit(0))return;const g=pending.metrics,type=classify(g,ball.z,ball.y,swingContext()),target=strokeTarget(g,ball,type);
''' +s[b:]
s=s.replace("if(type==='jump')jumpUntil", "if(['jump','jumpDrop'].includes(type))jumpUntil")
s=s.replace('launch(0,type,{x:targetX,y:depth},g.power)', 'launch(0,type,target,g.power)')
s=s.replace('players[i].shotType=type;', 'players[i].shotType=type;players[i].strokeTarget={...target};')
s=s.replace("for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.stepPhase=(p.stepPhase||0)+Math.hypot(p.vx,p.vy)*dt*4.5;", "for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;")
s=s.replace('players.forEach((p,i)=>movePlayer(p,i,dt));', 'players.forEach((p,i)=>{movePlayer(p,i,dt);updateMotion(p,dt,simTime);});')
s=s.replace("serverIndex===0?'클릭해서 대각선 서브'", "serverIndex===0?'짧게 클릭: 숏 · 길게 홀드: 롱 · 드래그: 코스'")
s=s.replace("project:(x,y,z)=>project(x,y,z)","pose:(i)=>buildPose(players[i],simTime),project:(x,y,z)=>project(x,y,z)")
p.write_text(s,encoding='utf-8')
p=Path('server.mjs');s=p.read_text(encoding='utf-8').replace("'physics.js']","'physics.js', 'motion.js']");p.write_text(s,encoding='utf-8')
p=Path('index.html');s=p.read_text(encoding='utf-8').replace('v0.3 · TOURNAMENT','v0.4 · MOTION & SWING').replace('BUILD 003 · 대회장 · 서비스 규칙 · 상황별 스윙','BUILD 004 · 관절 IK · 스윙 코스 · 숏/롱 서브')
s=s.replace('마우스 커서','드래그').replace('MOUSE</span> 조준','MOUSE</span> 드래그로 코스 + 구질')
s=s.replace('빠르게 스매시 · 천천히 드롭','강한 사선: 스매시 · 약한 사선: 드롭').replace('후방 / 높은 타점 · 아래로 드래그','아래 = 스트레이트 · 왼/오른쪽 아래 = 코스').replace('충전 → 점프 스매시','충전 → 점프 스매시 / 점프 드롭').replace('높은 클리어 / 언더 리턴에 0.45초 이상 홀드','0.45초 홀드 후 강하게 / 약하게 아래로').replace('짧은 클릭: 부드러운 드라이브','클릭 드라이브 · 드래그로 코스 지정')
s=s.replace('<section class="settings">','<section class="settings"><p>서브: 0.35초 미만은 숏 · 이상은 롱. 드래그로 대각선 서비스 구역 안에서 코스를 정하세요.</p>')
p.write_text(s,encoding='utf-8')
