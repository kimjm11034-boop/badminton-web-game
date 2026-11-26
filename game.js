import {createArena3D} from './renderer3d.js';
import {buildPose,updateMotion} from './motion.js';
import {COURT,DT,clamp,integrate,predictIntercept,gestureMetrics,classify,SHOTS,shotVelocity,groundWinner,matchWon,serviceLayout,validServiceLanding,strokeTarget,serviceTarget,judgeTiming,predictContactTime,timingRadius} from './physics.js';

const $=id=>document.getElementById(id), canvas=$('court'),ctx=canvas.getContext('2d'),gc=$('gesture').getContext('2d');
let arena3d=null;try{arena3d=createArena3D(canvas.parentElement);}catch(error){console.warn('WebGL fallback',error);}
const ui={assist:$('assist'),mode:$('mode'),points:$('points'),difficulty:$('difficulty'),sensitivity:$('sensitivity')};
let W=900,H=850,dpr=1,view=0,now=0,accumulator=0,lastFrame=0,simTime=0,uiTime=0,cameraZoom=1,cameraY=.44;
let phase='intro',paused=false,score=[0,0],rally=0,best=Number(localStorage.getItem('shuttle-best')||0),lastHit=1;
let serverIndex=0,service=null,serviceFlight=false,incomingType='clear',jumpUntil=0;
let ball=null,trail=[],particles=[],pending=null,nextServe=0,flash=0,shake=0,shotMessageUntil=0,hold=null,lastGesture=null;
let sound=false,audio=null,recording=[],lastReplay=[],replayTime=0,replaySaved=null,serveCount=0;
let gamePointer={x:0,y:0,inside:false};
const players=[{x:0,y:-3.2,vx:0,vy:0,side:-1,color:'#c6f481',react:0,swing:0,target:null}, {x:0,y:3.2,vx:0,vy:0,side:1,color:'#c8b4ff',react:0,swing:0,target:null}];
// 라이브 변경 시 점수와 설정은 유지하고, 진행 중 랠리는 새 서브로 전환합니다.
try {
  const saved=JSON.parse(sessionStorage.getItem('shuttle-session')||'null');
  if(saved){ score=saved.score||score;serverIndex=saved.serverIndex??0; for(const [id,value] of Object.entries(saved.settings||{})){if($(id).type==='checkbox')$(id).checked=value;else $(id).value=value;} if(saved.active){phase='waiting';nextServe=1.5;paused=!!saved.paused;$('overlay').classList.add('hidden');if(paused){$('pause').textContent='▷';$('pause').setAttribute('aria-label','계속하기');$('shot-title').textContent='일시정지';$('shot-sub').textContent='Space 또는 ▷로 계속하기';}} }
}catch{}
if(!sessionStorage.getItem('shuttle-v6')){ui.difficulty.value='hard';ui.assist.checked=true;sessionStorage.setItem('shuttle-v6','1');}
let timingFeedback={text:'',until:0,error:0};
function save(){sessionStorage.setItem('shuttle-session',JSON.stringify({score,serverIndex,active:!['intro','over'].includes(phase),paused,settings:Object.fromEntries(Object.values(ui).map(el=>[el.id,el.type==='checkbox'?el.checked:el.value]))}));}
for(const el of Object.values(ui))el.addEventListener('change',()=>{save();if(el===ui.points||el===ui.mode)restart();});
ui.sensitivity.addEventListener('input',()=>{$('sensitivity-value').value=Number(ui.sensitivity.value).toFixed(1)+'×';});
const live=new EventSource('/__live');
live.onopen=()=>{$('live-status').textContent='LIVE DEV';};
live.onerror=()=>{$('live-status').textContent='RECONNECTING';};
live.onmessage=e=>{if(e.data==='reload'){save();sessionStorage.setItem('shuttle-updated','1');location.reload();}};
if(sessionStorage.getItem('shuttle-updated')){sessionStorage.removeItem('shuttle-updated');$('update-toast').classList.add('show');setTimeout(()=>$('update-toast').classList.remove('show'),3500);}

// 카메라 좌표계로 변환한 후 원근 투영. z=0 그림자와 실제 z의 셔틀을 별도로 그립니다.
function cameraSpace(x,y,z=0){
  const cam=view===0?{x:0,y:-40,z:22}:{x:9,y:-36,z:22};
  const tx=-cam.x,ty=-cam.y,tz=.7-cam.z,len=Math.hypot(tx,ty,tz),f={x:tx/len,y:ty/len,z:tz/len};
  const rl=Math.hypot(f.x,f.y),r={x:f.y/rl,y:-f.x/rl,z:0};
  const u={x:r.y*f.z,y:-r.x*f.z,z:r.x*f.y-r.y*f.x};
  const dx=x-cam.x,dy=y-cam.y,dz=z-cam.z,depth=dx*f.x+dy*f.y+dz*f.z;
  const scale=Math.min(W*2.9,H*5.6)/depth;
  return {x:(dx*r.x+dy*r.y)*scale,y:-(dx*u.x+dy*u.y+dz*u.z)*scale,s:scale};
}
function project(x,y,z=0){if(arena3d)return arena3d.project(x,y,z);const p=cameraSpace(x,y,z);return {x:W*.5+p.x*cameraZoom,y:H*cameraY+p.y*cameraZoom,s:p.s*cameraZoom};}
function frameCamera(dt){
  // 높은 클리어가 화면 밖으로 사라지지 않도록 코트와 셔틀을 함께 프레이밍합니다.
  // 카메라만 부드럽게 줌아웃하며, 실제 월드 좌표와 물리 속도는 바꾸지 않습니다.
  const bounds=[cameraSpace(-2.59,-6.7),cameraSpace(2.59,-6.7),cameraSpace(-2.59,6.7),cameraSpace(2.59,6.7)];
  if(ball)bounds.push(cameraSpace(ball.x,ball.y,ball.z+.35));
  const minY=Math.min(...bounds.map(p=>p.y)),maxY=Math.max(...bounds.map(p=>p.y));
  const zoom=Math.min(1,(H-125)/Math.max(1,maxY-minY));
  const offset=clamp(H*.44,65-minY*zoom,H-60-maxY*zoom)/H;
  const smooth=1-Math.exp(-dt*9);cameraZoom+=(zoom-cameraZoom)*smooth;cameraY+=(offset-cameraY)*smooth;
}
function polygon(points,fill,stroke,width=1){ctx.beginPath();points.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function line(points,color,width=1){ctx.beginPath();points.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
function ellipse(x,y,z,rx,ry,fill){const p=project(x,y,z);ctx.beginPath();ctx.ellipse(p.x,p.y,rx*p.s,ry*p.s,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
function text3(text,x,y,z,size,color,font='600'){const p=project(x,y,z);ctx.fillStyle=color;ctx.textAlign='center';ctx.font=`${font} ${size*p.s}px "Barlow Condensed", sans-serif`;ctx.fillText(text,p.x,p.y);}
function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio,2);canvas.width=W*dpr;canvas.height=H*dpr;arena3d?.resize(W,H);const g=$('gesture').getBoundingClientRect();$('gesture').width=g.width*dpr;$('gesture').height=g.height*dpr;}
new ResizeObserver(resize).observe(canvas);resize();
function drawStadium(){
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#070d15');bg.addColorStop(1,'#17294b');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  // 대회장: 어두운 관중 배경, 무광 코트와 충분한 런오프. 스폰서 로고는 넣지 않습니다.
  polygon([[-13,-11,0],[13,-11,0],[13,10,0],[-13,10,0]],'#203b83');
  for(const side of [-1,1]){
    polygon([[side*5.2,-8.8,0],[side*5.2,9,0],[side*5.2,9,.65],[side*5.2,-8.8,.65]],'#c8443e','#df7262',1);
    for(let y=-7;y<9;y+=2.4)line([[side*5.2,y,.08],[side*5.2,y,.6]],'#f6b1a455',1);
    line([[side*5.2,-8.8,.67],[side*5.2,9,.67]],'#ea9187',2);
  }
  polygon([[-5.2,8.9,0],[5.2,8.9,0],[5.2,8.9,.9],[-5.2,8.9,.9]],'#c8443e','#ed8b78');
  polygon([[-3.55,-7.7,.005],[3.55,-7.7,.005],[3.55,7.7,.005],[-3.55,7.7,.005]],'#24785d');
  polygon([[-3.05,-6.7,.01],[3.05,-6.7,.01],[3.05,6.7,.01],[-3.05,6.7,.01]],'#319b75');
  const white='#f3f6ed';
  // 복식 외곽선도 표시하되 단식 득점 경계는 안쪽 5.18m입니다. 라인 폭 40mm.
  function marking(a,b){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len*.02,ny=dx/len*.02;polygon([[a[0]+nx,a[1]+ny,.025],[b[0]+nx,b[1]+ny,.025],[b[0]-nx,b[1]-ny,.025],[a[0]-nx,a[1]-ny,.025]],white);}
  for(const x of [-3.05,-2.59,2.59,3.05])marking([x,-6.7],[x,6.7]);
  for(const y of [-6.7,-5.94,-1.98,1.98,5.94,6.7])marking([-3.05,y],[3.05,y]);
  for(const side of [-1,1])marking([0,side*1.98],[0,side*6.7]);
  if(phase==='service'&&service){const x=service.server.x>0?1:-1;polygon([[0,service.side*1.98,.03],[x*2.59,service.side*1.98,.03],[x*2.59,service.side*6.7,.03],[0,service.side*6.7,.03]],'#fff4a51c');}
  drawOfficials();
}
function drawOfficials(){
  const x=-4.05,y=0;
  // 심판 좌석은 네트 높이 1.55m, 네트 연장선상 바깥쪽에 배치합니다.
  polygon([[x-.42,y-.5,0],[x+.42,y-.5,0],[x+.3,y-.32,1.5],[x-.3,y-.32,1.5]],'#b43e38','#ed7c6e');
  polygon([[x-.42,y+.5,0],[x-.42,y-.5,0],[x-.3,y-.32,1.5],[x-.3,y+.32,1.5]],'#852f35');
  for(const yy of [-.37,.37])line([[x-.28,yy,0],[x-.28,yy,1.9]],'#b0b8c6',2);
  polygon([[x-.3,-.35,1.55],[x+.3,-.35,1.55],[x+.3,.35,1.55],[x-.3,.35,1.55]],'#18243a');
  for(let z=.2;z<1.5;z+=.25)line([[x-.38,-.48,z],[x+.35,-.48,z]],'#adb5c3',2);
  official(x,0,1.55,true);
  polygon([[x+.15,-.3,2.02],[x+.5,-.3,2.02],[x+.5,.3,2.02],[x+.15,.3,2.02]],'#253349','#adb6c7');
  text3('1',x,-.51,.55,.5,'#f7eeee');
}
function official(x,y,z,high){
  const q=project(x,y,z),skin='#c8ac96';ellipse(x,y,z+.76,.12,.14,skin);
  line([[x,y,z+.1],[x,y,z+.53]],'#172e4a',.32*q.s);
  line([[x-.12,y,z+.13],[x+.2,y-.15,z+.04],[x+.2,y-.2,z-.38]],'#162335',.12*q.s);
  line([[x+.13,y,z+.45],[x+.3,y-.12,z+.25]],skin,.065*q.s);
}
function drawNet(){
  polygon([[-3.05,0,.76],[3.05,0,.76],[3.05,0,1.55],[-3.05,0,1.55]],'#17172680');
  for(let x=-3;x<=3;x+=.15)line([[x,0,.76],[x,0,1.54]],'#cabfe32d',.6);
  for(let z=.76;z<1.54;z+=.12)line([[-3.05,0,z],[3.05,0,z]],'#cabfe343',.65);
  line([[-3.05,0,1.55],[0,0,1.524],[3.05,0,1.55]],'#ebe6f9',3);
  for(const x of [-3.05,3.05]){ellipse(x,0,0,.17,.06,'#17122188');line([[x,0,0],[x,0,1.58]],'#d7d6e6',5);}
}
// 원근 투영된 3D 관절 좌표에 음영 캡슐을 입혀 팔/다리의 부피와 회전을 표현합니다.
function bodySegment(a,b,radius,color,highlight){
  const pa=project(...a),pb=project(...b),dx=pb.x-pa.x,dy=pb.y-pa.y,len=Math.hypot(dx,dy)||1;
  const width=radius*(pa.s+pb.s),nx=-dy/len*width*.45,ny=dx/len*width*.45;
  const grad=ctx.createLinearGradient(pa.x-nx,pa.y-ny,pa.x+nx,pa.y+ny);grad.addColorStop(0,color);grad.addColorStop(.45,highlight||color);grad.addColorStop(1,color);
  ctx.strokeStyle=grad;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();
}
function drawPlayer(p,index){
  const pose=buildPose(p,simTime,index===0?visualControls():{}),j=pose.joints;
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
function drawAim(){
  if(!hold||!ball)return;
  const g=gestureMetrics(hold.points,(performance.now()-hold.start)/1000,Number(ui.sensitivity.value));
  const type=classify(g,ball.z,ball.y,swingContext());
  const target=phase==='service'?serviceTarget(g,service):strokeTarget(g,ball,type),q=project(target.x,target.y,.04);
  ctx.save();ctx.setLineDash([3,6]);line([[ball.x,ball.y,.04],[target.x,target.y,.04]],'#e6f9ce66',1);ctx.restore();
  ctx.strokeStyle='#d0f69eaa';ctx.beginPath();ctx.ellipse(q.x,q.y,.18*q.s,.065*q.s,0,0,Math.PI*2);ctx.stroke();
}
function drawBall(){
  if(!ball)return;
  const shadow=project(ball.x,ball.y,.04),radius=.09+ball.z*.035;
  ctx.fillStyle=`rgba(17,9,28,${clamp(.5-ball.z*.05,.1,.5)})`;ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,radius*shadow.s,radius*.35*shadow.s,0,0,Math.PI*2);ctx.fill();
  for(let i=1;i<trail.length;i++){const a=project(trail[i-1].x,trail[i-1].y,trail[i-1].z),b=project(trail[i].x,trail[i].y,trail[i].z);ctx.strokeStyle=`rgba(218,239,189,${i/trail.length*.45})`;ctx.lineWidth=i/trail.length*2.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  const p=project(ball.x,ball.y,ball.z),prev=project(ball.x-ball.vx*.015,ball.y-ball.vy*.015,ball.z-ball.vz*.015),angle=Math.atan2(p.y-prev.y,p.x-prev.x);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);const k=clamp(p.s*.055,2.6,4.6);
  ctx.shadowBlur=5;ctx.shadowColor='#ffffff88';
  for(let j=0;j<16;j++){const a=j/16*Math.PI*2,yy=Math.sin(a)*k*1.25;ctx.fillStyle=j%2?'#f7faf1':'#d7e1dd';ctx.strokeStyle='#aabeb777';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(-k*.3,Math.sin(a)*k*.25);ctx.quadraticCurveTo(-k*1.6,yy*.7,-k*2.7,yy);ctx.lineTo(-k*2.9,yy-k*.28);ctx.quadraticCurveTo(-k*1.5,yy*.5,-k*.3,Math.sin(a)*k*.25);ctx.fill();ctx.stroke();}
  ctx.shadowBlur=0;ctx.strokeStyle='#b1c6be';ctx.lineWidth=.7;for(const xx of [-1,-1.6]){ctx.beginPath();ctx.ellipse(xx*k,0,k*.16,k*.72,0,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#233c30';ctx.fillRect(-k*.6,-k*.4,k*.45,k*.8);ctx.fillStyle='#eee6ce';ctx.beginPath();ctx.ellipse(0,0,k*.65,k*.46,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff9e7';ctx.beginPath();ctx.ellipse(k*.2,-k*.1,k*.35,k*.28,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
function visualControls(){
  if(phase==='replay'&&players[0].replayControls)return players[0].replayControls;
  const elapsed=simTime-(players[0].takeoff??-10);
  return {charge:hold?clamp((performance.now()-hold.start)/850,0,1):0,
    jump:elapsed>0&&elapsed<.58?.60*4*(elapsed/.58)*(1-elapsed/.58):0};
}
function render(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.save();if(shake>0)ctx.translate(Math.sin(now*.1)*shake,Math.cos(now*.08)*shake*.5);
  if(arena3d){
    ctx.clearRect(0,0,W,H);
    arena3d.render({players,time:simTime,ball,trail,view,...visualControls()});
    drawAim();
  }else{
  drawStadium();drawAim();drawPlayer(players[1],1);if(ball&&ball.y>0)drawBall();drawNet();drawPlayer(players[0],0);if(ball&&ball.y<=0)drawBall();
  for(const p of particles){const q=project(p.x,p.y,p.z);ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;ctx.fillRect(q.x,q.y,3,3);}ctx.globalAlpha=1;
  const vignette=ctx.createRadialGradient(W*.5,H*.5,H*.1,W*.5,H*.5,H*.85);vignette.addColorStop(0,'#09061400');vignette.addColorStop(1,'#09061488');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  }
  if(hold){ctx.strokeStyle='#c9ff8ca0';ctx.lineWidth=2;ctx.beginPath();hold.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.beginPath();ctx.arc(hold.points[0].x,hold.points[0].y,5,0,Math.PI*2);ctx.stroke();}
  ctx.restore();drawGesture();updateTimingCue();
}
function contactMoment(){return hold&&swingContext().highReturn&&(performance.now()-hold.start)>.45*1000?players[0].jumpAt:players[0].contactAt;}
function updateTimingCue(){
 const cue=$('timing-cue'),incoming=phase==='playing'&&lastHit===1,feedback=timingFeedback.until>simTime;
 cue.hidden=!ui.assist.checked||(!incoming&&!feedback)||phase==='intro'||(!gamePointer.inside&&!hold);if(cue.hidden)return;
 // SVG 중심(40,40) 기준으로 계산해 목표 원 가장자리를 커서에서 약 12px만 띄웁니다.
 const centerX=gamePointer.x+62>W?gamePointer.x-34:gamePointer.x+34;
 const centerY=gamePointer.y<42?gamePointer.y+34:gamePointer.y-10;
 const top=clamp(centerY-40,8,H-88);
 cue.style.left=clamp(centerX-40,8,W-88)+'px';cue.style.top=top+'px';
 cue.classList.toggle('labels-above',top+116>H-8);
 const moment=contactMoment()||simTime,error=feedback?timingFeedback.error:simTime-moment;
 const radius=timingRadius(error)*1.2;
 $('timing-circle').setAttribute('r',String(radius));
 const grade=judgeTiming(error);$('timing-verdict').textContent=feedback?timingFeedback.text:Math.abs(error)<.08?'지금!':error<0?'원에 맞춰 놓기':'조금 늦었어요';
 cue.dataset.grade=feedback?timingFeedback.text:grade;
 $('timing-countdown').textContent=feedback?'타이밍 피드백':error<0?(-error).toFixed(2)+'초':'다음 타점 준비';
}
function timingResult(grade,error=0){timingFeedback={text:grade,until:simTime+1.35,error};$('last-grade').textContent=grade;}

function drawGesture(){
  const c=$('gesture'),w=c.width/dpr,h=c.height/dpr;gc.setTransform(dpr,0,0,dpr,0,0);gc.clearRect(0,0,w,h);gc.strokeStyle='#ffffff09';gc.lineWidth=1;
  for(let x=8;x<w;x+=18)for(let y=12;y<h;y+=18){gc.fillStyle='#68677c35';gc.fillRect(x,y,1,1);}
  const points=hold?.points||lastGesture?.points;
  if(!points||points.length<2){gc.fillStyle='#676679';gc.font='9px sans-serif';gc.textAlign='center';gc.fillText('PRESS  →  DRAG  →  RELEASE',w/2,h/2+5);return;}
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys),rangeX=Math.max(...xs)-minX,rangeY=Math.max(...ys)-minY;
  const scale=Math.min((w-32)/Math.max(rangeX,80),(h-24)/Math.max(rangeY,50)),ox=(w-rangeX*scale)/2,oy=(h-rangeY*scale)/2;
  gc.strokeStyle=hold?'#c0f881':'#ab99d8';gc.lineWidth=2;gc.beginPath();points.forEach((p,i)=>{const x=ox+(p.x-minX)*scale,y=oy+(p.y-minY)*scale;i?gc.lineTo(x,y):gc.moveTo(x,y);});gc.stroke();
  const end=points.at(-1);gc.fillStyle='#c0f881';gc.beginPath();gc.arc(ox+(end.x-minX)*scale,oy+(end.y-minY)*scale,3,0,Math.PI*2);gc.fill();
}
function announce(title,sub='',duration=1.6){$('shot-title').textContent=title;$('shot-sub').textContent=sub;shotMessageUntil=simTime+duration;}
function beep(type){if(!sound)return;try{audio??=new AudioContext();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.setValueAtTime(type==='hit'?680:280,audio.currentTime);o.frequency.exponentialRampToValueAtTime(130,audio.currentTime+.1);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.13);o.start();o.stop(audio.currentTime+.14);}catch{}}
function updateScore(){$('score-you').textContent=score[0];$('score-ai').textContent=score[1];$('rally').textContent=String(rally).padStart(2,'0');$('best').textContent=String(best).padStart(2,'0');$('point-rule').textContent=ui.mode.value==='practice'?'PRACTICE':ui.points.value+' POINTS';}
function serve(){
  phase='service';rally=0;pending=null;recording=[];trail=[];serveCount++;serviceFlight=false;
  if(ui.mode.value==='practice')serverIndex=1;
  service=serviceLayout(serverIndex,score[serverIndex]);
  players.forEach((p,i)=>{const spot=i===serverIndex?service.server:service.receiver;Object.assign(p,spot,{vx:0,vy:0,target:null,motion:null,swing:-10,shotType:null,contactAt:null,jumpAt:null,contactPoint:null,takeoff:null,replayControls:null});});
  ball={...service.server,z:1.05,vx:0,vy:0,vz:0};lastHit=serverIndex;
  nextServe=simTime+1.2;
  announce(serverIndex===0?'나의 서브':'상대 서브',`${score[serverIndex]}점 · ${service.parity==='RIGHT'?'오른쪽':'왼쪽'} 서비스 코트 · 대각선 서브`,4);updateScore();
}
function deliverService(metrics={dx:0,dy:0,duration:.6}){
  phase='playing';serviceFlight=true;lastHit=serverIndex;incomingType='lift';
  const target=serviceTarget(metrics,service);players[serverIndex].contactPoint={...ball};const v=shotVelocity(ball,target,target.type);Object.assign(ball,{vx:v.vx,vy:v.vy,vz:v.vz});
  players[serverIndex].swing=simTime;players[serverIndex].shotType=target.type;
  planReception(1-serverIndex);
  announce(target.type==='serveShort'?'숏 서브':'롱 서브',`${service.parity==='RIGHT'?'짝수 · 오른쪽':'홀수 · 왼쪽'} → 대각선 서비스 코트`,1);
}

function start(){if(phase==='intro'||phase==='over'){$('overlay').classList.add('hidden');phase='waiting';nextServe=simTime+.35;paused=false;updateScore();}}
$('start').addEventListener('click',start);
function restart(){score=[0,0];serverIndex=0;ball=null;pending=null;hold=null;timingFeedback={text:'',until:0};rally=0;paused=false;phase='waiting';nextServe=simTime+.7;$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ';updateScore();save();}
$('restart').onclick=restart;
function togglePause(){if(phase==='intro'||phase==='over'||phase==='replay')return;paused=!paused;hold=null;pending=null;$('pause').textContent=paused?'▷':'Ⅱ';$('pause').setAttribute('aria-label',paused?'계속하기':'일시정지');$('shot-title').textContent=paused?'일시정지':'';$('shot-sub').textContent=paused?'Ⅱ 버튼 또는 Space로 계속하기':'';}
$('pause').onclick=togglePause;
$('sound').onclick=()=>{sound=!sound;$('sound').style.color=sound?'#b5f573':'';$('sound').setAttribute('aria-label',sound?'효과음 끄기':'효과음 켜기');if(sound)beep('hit');};
$('camera').onclick=()=>{view=1-view;};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['SELECT','INPUT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();togglePause();}});
let visibilityTimer;
document.addEventListener('visibilitychange',()=>{
  clearTimeout(visibilityTimer);
  // 브라우저가 포커스를 옮기는 순간의 일시적인 hidden 이벤트는 무시합니다.
  if(document.hidden)visibilityTimer=setTimeout(()=>{if(document.hidden&&phase==='playing'&&!paused)togglePause();},150);
});
window.addEventListener('blur',()=>{hold=null;});
function pointerPosition(e){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;gamePointer={x,y,inside:x>=0&&x<=rect.width&&y>=0&&y<=rect.height};return {x,y,t:performance.now()};}
canvas.addEventListener('pointerenter',pointerPosition);
canvas.addEventListener('pointerleave',()=>{gamePointer.inside=false;});

canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||!['playing','service'].includes(phase)||paused)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=pointerPosition(e);hold={points:[p],start:p.t,id:e.pointerId};pending=null;
});
canvas.addEventListener('pointermove',e=>{const p=pointerPosition(e);if(hold&&hold.id===e.pointerId){hold.points.push(p);if(hold.points.length>240)hold.points.splice(1,1);}});
canvas.addEventListener('pointerup',e=>{
  if(!hold||hold.id!==e.pointerId)return;const displayedMoment=contactMoment();const p=pointerPosition(e);hold.points.push(p);
  const metrics=gestureMetrics(hold.points,(p.t-hold.start)/1000,Number(ui.sensitivity.value));
  lastGesture={points:hold.points,metrics};hold=null;canvas.releasePointerCapture(e.pointerId);
  if(phase==='service'&&serverIndex===0&&!paused){showMetrics(metrics);deliverService(metrics);return;}
  if(phase!=='playing'||paused)return;
  if(['jump','jumpDrop'].includes(classify(metrics,ball.z,ball.y,swingContext()))){
    players[0].takeoff=simTime;
    jumpUntil=simTime+.6;metrics.power=Math.max(metrics.power,clamp(metrics.duration/.85,0,1));
  }
  const moment=displayedMoment;
  const error=simTime-(moment||simTime);timingResult(judgeTiming(error),error);
  pending={metrics,expires:simTime+.9};showMetrics(metrics);
  if(canHit(0))hitPlayer();else $('gesture-state').textContent='QUEUED';
});
canvas.addEventListener('pointercancel',()=>{hold=null;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function canHit(i){const p=players[i],jumpReach=i===0&&jumpUntil>simTime?.6:0;return ball&&lastHit!==i&&ball.y*p.side>.2&&ball.z>.3&&ball.z<2.8+jumpReach&&Math.hypot(ball.x-p.x,ball.y-p.y)<(i===1?(ui.difficulty.value==='hard'?1.0:.8):1.05);}
function swingContext(){return {highReturn:['clear','lift'].includes(incomingType),defending:['smash','jump','push'].includes(incomingType)&&Math.abs(ball?.y||0)>2.15};}
function showMetrics(g){
  const dragLength=Math.hypot(g.dx,g.dy);
  $('speed').innerHTML=Math.round(g.speed)+'<small> px/s</small>';$('hold').innerHTML=g.duration.toFixed(2)+'<small> s</small>';$('distance').innerHTML=Math.round(dragLength)+'<small> /72 px</small>';
  $('distance').style.color=dragLength>=72?'#ffce89':'#e5e3ee';
  const charge=clamp(g.duration/.85,0,1);$('power').style.width=(hold?charge:g.power)*100+'%';$('power-label').textContent=hold?Math.round(charge*100)+'% CHARGE':Math.round(g.power*100)+'%';
  if(phase==='service'){$('intent-name').textContent=g.duration<.35?'숏 서브':'롱 서브';$('intent-icon').textContent=g.duration<.35?'⌒':'⤴';$('intent-desc').textContent='드래그 방향으로 대각선 서비스 구역 조준';$('gesture-state').textContent='SERVICE';return;}
  const type=classify(g,ball?.z||2.4,ball?.y||players[0].y,swingContext()),s=SHOTS[type];$('intent-icon').textContent=s.icon;$('intent-name').textContent=s.name;
  const context=swingContext(),zone=context.defending?'수비 상황':Math.abs(ball?.y||players[0].y)<2.15?'네트 앞':'후방 / 오버헤드';
  $('intent-desc').textContent=hold?zone+' · '+(context.highReturn&&g.duration>=.45?'점프 준비 · 짧게 드롭 / 길게 스매시':'72px 미만 드롭 / 이상 스매시'):zone+' · 입력 분석 완료';$('gesture-state').textContent=hold?'TRACKING':'RELEASED';
}
function hitPlayer(){
  if(!pending||!canHit(0))return;const g=pending.metrics,type=classify(g,ball.z,ball.y,swingContext()),target=strokeTarget(g,ball,type);
  const height=ball.z,grade=timingFeedback.text;
  if(['jump','jumpDrop'].includes(type))jumpUntil=simTime+.6;
  const v=launch(0,type,target,g.power);
  $('intent-name').textContent=SHOTS[type].name;$('intent-icon').textContent=SHOTS[type].icon;$('last-grade').textContent=grade;$('height').textContent=height.toFixed(2)+' m';$('velocity').textContent=(v.speed*3.6).toFixed(0)+' km/h';
  const gestureLabel=g.dy>3?(g.dx< -3?'왼쪽 아래':g.dx>3?'오른쪽 아래':'아래 직선'):g.dy< -5?(g.dx< -3?'왼쪽 위':g.dx>3?'오른쪽 위':'위 직선'):Math.abs(g.dx)>4?'수평 드래그':'약한 클릭';
  $('last-feedback').textContent=`${gestureLabel} · ${g.duration.toFixed(2)}초 준비 · ${Math.round(g.speed)} px/s 릴리스. ${height.toFixed(1)}m 타점에서 ${SHOTS[type].name} · ${grade}.`;
  pending=null;$('gesture-state').textContent='CONTACT';
}
function planReception(i){
 const p=players[i];
 if(i===0){p.target=predictIntercept(ball,p.side,p);p.react=simTime+.12;p.contactAt=simTime+predictContactTime(ball,-1);p.jumpAt=simTime+predictContactTime(ball,-1,3.0);return;}
 p.target={x:p.x*.5,y:3.45};p.react=simTime+.12;
 p.contactAt=simTime+predictContactTime(ball,p.side);
 p.readAt=simTime+(ui.difficulty.value==='hard'?.14:ui.difficulty.value==='easy'?.36:.25);
 p.intent='WAIT / READ';
}
function launch(i,type,target,power=.7){
  players[i].contactPoint={...ball};
  const v=shotVelocity(ball,target,type,power);Object.assign(ball,{vx:v.vx,vy:v.vy,vz:v.vz});lastHit=i;serviceFlight=false;if(i===1)incomingType=type;rally++;players[i].swing=simTime;players[i].shotType=type;players[i].strokeTarget={...target};players[i].target=null;planReception(1-i);
  trail=[];shake=['smash','jump'].includes(type)?3:1;flash=.25;
  for(let j=0;j<14;j++)particles.push({x:ball.x,y:ball.y,z:ball.z,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,vz:Math.random()*3,life:.45,color:SHOTS[type].color});
  if(i===0)announce(SHOTS[type].name,'좋아요, 다음 타점을 준비하세요',1.05);else announce('상대 · '+SHOTS[type].name,'상대 타격 · 자동 풋워크 이동 중',.7);
  beep('hit');updateScore();return v;
}
function aiHit(){
  if(!canHit(1)||simTime<players[1].react)return;
  const b=ball;let type='clear';const r=Math.random();
  if(ui.mode.value!=='practice'){if(b.z>2.15&&Math.abs(b.y)<4.8&&r<.38)type='smash';else if(r<.62)type='drop';}
  if(b.z<1.3)type='lift';
  const difficulty=ui.difficulty.value==='hard'?1.25:ui.difficulty.value==='easy'?.7:1;
  const tx=-Math.sign(players[0].x||Math.random()-.5)*(1.1+Math.random()*.7)*difficulty;
  launch(1,type,{x:tx,y:type==='drop'?-(1.1+Math.random()*.5):type==='smash'?-3:-5.2});
}
function endPoint(winner,reason){
  if(phase!=='playing')return;phase='waiting';nextServe=simTime+2.2;pending=null;hold=null;
  for(const p of players){p.vx=0;p.vy=0;p.target=null;}
  if(ui.mode.value==='match')score[winner]++;
  if(rally>best){best=rally;localStorage.setItem('shuttle-best',String(best));}
  serverIndex=winner;serviceFlight=false;
  lastReplay=recording.slice();$('replay').disabled=lastReplay.length<2;
  announce(ui.mode.value==='practice'?'다음 연습구':winner===0?'나의 득점':'상대 득점',reason,2.1);beep('point');updateScore();save();
  if(ui.mode.value==='match'&&matchWon(score,Number(ui.points.value))){phase='over';setTimeout(()=>{if(phase!=='over')return;$('overlay').innerHTML=`<div class="intro"><div class="eyebrow">MATCH COMPLETE</div><h1>${score[0]>score[1]?'멋진 경기였어요.':'다음 랠리는 당신의 것.'}</h1><p>YOU ${score[0]} : ${score[1]} NOVA · 최장 랠리 ${best}회</p><button class="primary" id="again">다시 경기하기 ↗</button></div>`;$('overlay').classList.remove('hidden');$('again').onclick=restart;},900);}
}
function movePlayer(p,i,dt){
  let target=lastHit!==i&&ball&&phase==='playing'?p.target:null;
  target??={x:0,y:p.side*3.2};
  if(simTime<p.react)return;
  const tx=clamp(target.x,-3,3),ty=clamp(target.y*p.side,.5,6.9)*p.side,dx=tx-p.x,dy=ty-p.y;
  // 양쪽 선수의 가속/최고 속도는 동일. 후위 스텝은 전진보다 느립니다.
  const maxSpeed=(dy*p.side>0?4.4:5.4)*(i===1?(ui.difficulty.value==='hard'?1.12:ui.difficulty.value==='easy'?.78:.9):1);
  const vx=dx*8,vy=dy*8,mag=Math.hypot(vx,vy),factor=mag>maxSpeed?maxSpeed/mag:1;
  p.vx+=(vx*factor-p.vx)*Math.min(1,dt*11);p.vy+=(vy*factor-p.vy)*Math.min(1,dt*11);p.x+=p.vx*dt;p.y+=p.vy*dt;p.stepPhase=(p.stepPhase||0)+Math.hypot(p.vx,p.vy)*dt*4.5;
}
function tick(dt){
  simTime+=dt;shake=Math.max(0,shake-dt*12);flash=Math.max(0,flash-dt);
  if(shotMessageUntil<simTime){$('shot-title').textContent='';$('shot-sub').textContent='';}
  for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=5*dt;}particles=particles.filter(p=>p.life>0);
  if(phase==='waiting'&&simTime>=nextServe)serve();
  if(phase==='service'&&serverIndex===1&&simTime>=nextServe)deliverService();
  if(phase!=='playing'){
    if(phase==='waiting')for(const p of players)if(p.motion)updateMotion(p,dt,simTime);
    return;
  }
  const ai=players[1];if(lastHit===0&&ai.readAt&&simTime>=ai.readAt){ai.target=predictIntercept(ball,ai.side,ai);ai.target.x+=(ui.difficulty.value==='hard'?.02:ui.difficulty.value==='easy'?.17:.08)*Math.sin(simTime*5);ai.readAt=0;ai.intent=ball.z>3?'RECOVER DEEP':ball.z>1.5?'INTERCEPT':'LUNGE';}
  players.forEach((p,i)=>{movePlayer(p,i,dt);updateMotion(p,dt,simTime);});
  if(pending){
    if(canHit(0))hitPlayer();
    else if(simTime>pending.expires){pending=null;$('gesture-state').textContent='READY';$('last-feedback').textContent='타점에 닿지 않았어요. 다시 스윙해 보세요. 즉시 실점은 없습니다.';}
  }
  if(lastHit===0&&ball.vz<1)aiHit();
  const prev={...ball};integrate(ball,dt);
  // 네트 평면을 통과한 순간의 z를 선형 보간하여 고속 스매시의 터널링을 방지합니다.
  if(prev.y*ball.y<0){const f=-prev.y/(ball.y-prev.y),z=prev.z+(ball.z-prev.z)*f,x=prev.x+(ball.x-prev.x)*f;
    const net=COURT.net+.026*Math.min(1,Math.abs(x)/3.05);
    if(z<=net&&Math.abs(x)<=3.05){ball.y=0;ball.z=z;ball.vx=ball.vy=ball.vz=0;endPoint(1-lastHit,'NET · 셔틀이 네트를 넘지 못했습니다');return;}}
  if(ball.z<=0){const f=prev.z/(prev.z-ball.z);ball.x=prev.x+(ball.x-prev.x)*f;ball.y=prev.y+(ball.y-prev.y)*f;ball.z=.03;const out=Math.abs(ball.x)>2.61||Math.abs(ball.y)>6.72;endPoint(serviceFlight&&!validServiceLanding(ball,service)?1-serverIndex:groundWinner(ball,lastHit),serviceFlight&&!validServiceLanding(ball,service)?'SERVICE FAULT · 대각선 서비스 구역 밖':out?'OUT · 코트 경계 밖으로 나갔습니다':'IN · 셔틀이 코트에 떨어졌습니다');}
  if(!Number.isFinite(ball.x)||Math.abs(ball.y)>35){endPoint(1-lastHit,'OUT · 코트 밖');}
}
function updateUI(){
  if(hold){
    // 정지 상태도 샘플링: 오래 홀드한 시간을 마지막 손목 동작의 이동 시간으로 오해하지 않습니다.
    const last=hold.points.at(-1),t=performance.now();if(t-last.t>25)hold.points.push({...last,t});
    if(hold.points.length>240)hold.points.splice(1,1);
    showMetrics(gestureMetrics(hold.points,(t-hold.start)/1000,Number(ui.sensitivity.value)));
  }
  if(phase==='service'){$('timing-text').textContent=serverIndex===0?'짧게 클릭: 숏 · 길게 홀드: 롱 · 드래그: 코스':'NOVA 서브 준비';$('footwork').textContent='SERVICE · '+service.parity;}
  if(phase==='playing'&&ball){const reachable=canHit(0),incoming=lastHit===1;const t=players[0].target;
    $('timing-text').textContent=reachable?'두 원이 겹칠 때 놓으세요!':pending?'스윙 기억 중 · 타점으로 이동':incoming?'마우스 옆 원형 게이지에 타이밍을 맞추세요':'상대 리턴을 기다리세요';
    $('timing-fill').style.width=reachable?'100%':incoming?clamp(1-Math.hypot(ball.x-players[0].x,ball.y-players[0].y)/7,0,1)*80+'%':'0%';
    $('footwork').textContent=reachable?'CONTACT WINDOW':incoming?'MOVING TO INTERCEPT':'RECOVERING TO BASE';
  }
}
function captureFrame(){if(phase!=='playing')return;recording.push({ball:{...ball},players:players.map(p=>structuredClone(p)),controls:visualControls(),time:simTime});if(recording.length>1800)recording.shift();}
$('replay').onclick=()=>{
  if(!lastReplay.length||phase==='replay')return;replaySaved={phase,ball:ball&&{...ball},players:players.map(p=>({...p})),simTime,paused,nextServe};replayTime=0;phase='replay';paused=false;hold=null;pending=null;trail=[];announce('다시 보기','마지막 랠리 · 0.65× 슬로 모션',100);$('replay').disabled=true;
};
function replay(dt){
  replayTime+=dt*.65;const first=lastReplay[0],target=first.time+replayTime;
  const frame=lastReplay.find(f=>f.time>=target);
  if(!frame){phase=replaySaved.phase;ball=replaySaved.ball;simTime=replaySaved.simTime;paused=replaySaved.paused;nextServe=simTime+1;players.forEach((p,i)=>Object.assign(p,replaySaved.players[i]));$('replay').disabled=false;announce('다시 보기 종료','다음 랠리를 준비하세요',.8);return;}
  ball={...frame.ball};players.forEach((p,i)=>Object.assign(p,frame.players[i],{replayControls:i?null:frame.controls}));simTime=frame.time;
}
function frame(time){
  now=time;const elapsed=Math.min((time-lastFrame)/1000||0,.05);lastFrame=time;
  if(!paused){if(phase==='replay')replay(elapsed);else{accumulator+=elapsed;while(accumulator>=DT){tick(DT);accumulator-=DT;}}}
  if(time-uiTime>33){uiTime=time;updateUI();if(!paused&&ball){trail.push({x:ball.x,y:ball.y,z:ball.z});if(trail.length>55)trail.shift();captureFrame();}}
  frameCamera(elapsed);render();requestAnimationFrame(frame);
}
updateScore();requestAnimationFrame(frame);
// 개발 검증용 읽기 전용 스냅샷. 브라우저에서 현재 물리/스코어 상태를 확인할 수 있습니다.
window.shuttleLab={snapshot:()=>({renderer:arena3d?'WebGL 3D':'Canvas fallback',phase,paused,score:[...score],serverIndex,service,serviceFlight,incomingType,rally,lastHit,simTime,ball:ball&&{...ball},players:players.map(p=>({...p})),pending:!!pending}),pose:(i)=>buildPose(players[i],simTime,i===0?visualControls():{}),project:(x,y,z)=>project(x,y,z)};
