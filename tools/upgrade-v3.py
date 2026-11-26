from pathlib import Path
p=Path('game.js');s=p.read_text(encoding='utf-8')
s=s.replace('groundWinner,matchWon}', 'groundWinner,matchWon,serviceLayout,validServiceLanding}')
s=s.replace("let ball=null,trail=[]", "let serverIndex=0,service=null,serviceFlight=false,incomingType='clear',jumpUntil=0;\nlet ball=null,trail=[]")
s=s.replace("score=saved.score||score;", "score=saved.score||score;serverIndex=saved.serverIndex??0;")
s=s.replace('JSON.stringify({score,active:', 'JSON.stringify({score,serverIndex,active:')
start=s.index('function drawStadium(){');end=s.index('function drawNet()',start)
s=s[:start]+'''function drawStadium(){
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#070d15');bg.addColorStop(1,'#17294b');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  // 대회장: 어두운 관중 배경, 무광 코트와 충분한 런오프. 스폰서 로고는 넣지 않습니다.
  for(let row=6;row>=0;row--){
    const y=10.5+row*.86,z=.35+row*.57;
    polygon([[-15,y,z],[15,y,z],[15,y+.8,z],[-15,y+.8,z]],row%2?'#151c25':'#1b2430');
    for(let j=0;j<46;j++){
      const x=-14.5+j*.65;if(Math.abs(x)<.65)continue;
      const q=project(x,y+.15,z+.1),c=['#273d38','#3c3842','#294439','#42414a'][(j+row*3)%4];
      ctx.fillStyle=c;ctx.beginPath();ctx.roundRect(q.x-5,q.y-5,10,13,2);ctx.fill();
      if((j*7+row)%5!==0){ellipse(x,y,z+.61,.095,.1,['#a18b7c','#746052','#b39b8b'][(j+row)%3]);line([[x,y,z+.1],[x,y,z+.43]],['#293443','#383249','#363d3a','#273958'][(j*3+row)%4],.23*q.s);}
    }
  }
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
  official(4.05,0,.43,false);
  for(const xx of [-2.59,2.59])official(xx,9,.4,false);
  text3('1',x,-.51,.55,.5,'#f7eeee');
}
function official(x,y,z,high){
  const q=project(x,y,z),skin='#c8ac96';ellipse(x,y,z+.76,.12,.14,skin);
  line([[x,y,z+.1],[x,y,z+.53]],'#172e4a',.32*q.s);
  line([[x-.12,y,z+.13],[x+.2,y-.15,z+.04],[x+.2,y-.2,z-.38]],'#162335',.12*q.s);
  line([[x+.13,y,z+.45],[x+.3,y-.12,z+.25]],skin,.065*q.s);
}
''' +s[end:]
# locomotion body movement and footwork
s=s.replace("stride=Math.sin(simTime*12)*.22*walk;", "stride=Math.sin((p.stepPhase||0))*.3*walk;")
s=s.replace("const x=p.x,y=p.y,z=bob;", "const jump=index===0?Math.sin(clamp((jumpUntil-simTime)/.6,0,1)*Math.PI)*.7:0;\n  const x=p.x+p.vx*.015,y=p.y,z=bob+jump;")
s=s.replace("const hip=[x,y,z+.79],shoulder=[x,y,z+1.27]", "const hip=[x,y,z+.75-walk*.07],shoulder=[x+p.vx*.025,y+p.vy*.025,z+1.25-walk*.07]")
s=s.replace("['net','lift'].includes(p.shotType)","['net','lift','block'].includes(p.shotType)")
# modern racket exact small block
rs=s.index('  const r=project(...racket);');re=s.index("  ctx.fillStyle='#dbc8cb'",rs)
s=s[:rs]+'''  const r=project(...racket);ctx.save();ctx.translate(r.x,r.y);ctx.rotate(-.3+bend*1.6);
  lineRacket(r.s,index);ctx.restore();
''' +s[re:]
insert=s.index('function drawAim()')
s=s[:insert]+'''function lineRacket(scale,index){
  ctx.strokeStyle='#151e28';ctx.lineWidth=.038*scale;ctx.beginPath();ctx.ellipse(0,-.12*scale,.145*scale,.2*scale,0,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle=index===0?'#48dcc9':'#fb866a';ctx.lineWidth=.018*scale;ctx.beginPath();ctx.ellipse(0,-.12*scale,.14*scale,.195*scale,0,0,Math.PI*2);ctx.stroke();
  ctx.save();ctx.beginPath();ctx.ellipse(0,-.12*scale,.13*scale,.184*scale,0,0,Math.PI*2);ctx.clip();ctx.strokeStyle='#e9f5ef90';ctx.lineWidth=.45;
  for(let i=-6;i<=6;i++){ctx.beginPath();ctx.moveTo(i*.025*scale,-.33*scale);ctx.lineTo(i*.025*scale,.1*scale);ctx.moveTo(-.15*scale,i*.029*scale-.12*scale);ctx.lineTo(.15*scale,i*.029*scale-.12*scale);ctx.stroke();}ctx.restore();
}
''' +s[insert:]
# shuttle: feather cone direction opposite velocity
bs=s.index("  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);");be=s.index('\n}',bs)
s=s[:bs]+'''  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);const k=clamp(p.s*.055,2.6,4.6);
  ctx.shadowBlur=5;ctx.shadowColor='#ffffff88';
  for(let j=0;j<16;j++){const a=j/16*Math.PI*2,yy=Math.sin(a)*k*1.25;ctx.fillStyle=j%2?'#f7faf1':'#d7e1dd';ctx.strokeStyle='#aabeb777';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(-k*.3,Math.sin(a)*k*.25);ctx.quadraticCurveTo(-k*1.6,yy*.7,-k*2.7,yy);ctx.lineTo(-k*2.9,yy-k*.28);ctx.quadraticCurveTo(-k*1.5,yy*.5,-k*.3,Math.sin(a)*k*.25);ctx.fill();ctx.stroke();}
  ctx.shadowBlur=0;ctx.strokeStyle='#b1c6be';ctx.lineWidth=.7;for(const xx of [-1,-1.6]){ctx.beginPath();ctx.ellipse(xx*k,0,k*.16,k*.72,0,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#233c30';ctx.fillRect(-k*.6,-k*.4,k*.45,k*.8);ctx.fillStyle='#eee6ce';ctx.beginPath();ctx.ellipse(0,0,k*.65,k*.46,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff9e7';ctx.beginPath();ctx.ellipse(k*.2,-k*.1,k*.35,k*.28,0,0,Math.PI*2);ctx.fill();ctx.restore();''' +s[be:]
ss=s.index('function serve(){');se=s.index('\nfunction start()',ss)
s=s[:ss]+'''function serve(){
  phase='service';rally=0;pending=null;recording=[];trail=[];serveCount++;serviceFlight=false;
  if(ui.mode.value==='practice')serverIndex=1;
  service=serviceLayout(serverIndex,score[serverIndex]);
  players.forEach((p,i)=>{const spot=i===serverIndex?service.server:service.receiver;Object.assign(p,spot,{vx:0,vy:0,target:null});});
  ball={...service.server,z:1.05,vx:0,vy:0,vz:0};lastHit=serverIndex;
  nextServe=simTime+1.2;
  announce(serverIndex===0?'YOUR SERVICE':'NOVA SERVICE',`${score[serverIndex]}점 · ${service.parity==='RIGHT'?'오른쪽':'왼쪽'} 서비스 코트 · 대각선 서브`,4);updateScore();
}
function deliverService(){
  phase='playing';serviceFlight=true;lastHit=serverIndex;incomingType='lift';
  const v=shotVelocity(ball,service.receiver,'lift');Object.assign(ball,{vx:v.vx,vy:v.vy,vz:v.vz});
  players[serverIndex].swing=simTime;players[serverIndex].shotType='lift';
  players[1-serverIndex].target=predictIntercept(ball,players[1-serverIndex].side,players[1-serverIndex]);players[1-serverIndex].react=simTime+.12;
  announce('SERVICE',`${service.parity==='RIGHT'?'짝수 · 오른쪽':'홀수 · 왼쪽'} → 대각선 서비스 코트`,1);
}
''' +s[se:]
s=s.replace("score=[0,0];ball=null", "score=[0,0];serverIndex=0;ball=null")
s=s.replace("if(e.button!==0||phase!=='playing'||paused)return;", "if(e.button!==0||!['playing','service'].includes(phase)||paused)return;")
s=s.replace("  if(phase!=='playing'||paused)return;\n  pending=", "  if(phase==='service'&&serverIndex===0&&!paused){deliverService();return;}\n  if(phase!=='playing'||paused)return;\n  pending=")
pos=s.index('function showMetrics(')
s=s[:pos]+'''function swingContext(){return {highReturn:['clear','lift'].includes(incomingType),defending:['smash','jump','push'].includes(incomingType)&&Math.abs(ball?.y||0)>2.15};}
''' +s[pos:]
s=s.replace("classify(g,ball?.z||2.4,players[0].y)","classify(g,ball?.z||2.4,ball?.y||players[0].y,swingContext())")
s=s.replace("$('power').style.width=g.power*100+'%';$('power-label').textContent=Math.round(g.power*100)+'%';", "const charge=clamp(g.duration/.85,0,1);$('power').style.width=(hold?charge:g.power)*100+'%';$('power-label').textContent=hold?Math.round(charge*100)+'% CHARGE':Math.round(g.power*100)+'%';")
s=s.replace("classify(g,ball.z,ball.y),targetX=clamp(pending.aim+(type==='slice'?Math.sign(g.dx)*.45:0),-2.28,2.28)", "classify(g,ball.z,ball.y,swingContext()),direction=Math.abs(g.dx)>24?Math.sign(g.dx):0,targetX=clamp(direction?direction*(1.2+Math.min(Math.abs(g.dx)/180,1)):pending.aim,-2.28,2.28)")
s=s.replace("['drop','slice','net'].includes(type)? .65+g.power*.9", "['drop','slice','net','block'].includes(type)? .65+g.power*.9")
s=s.replace("type==='smash'?2.0+g.power*1.7:type==='drive'?3.2+g.power*1.8", "['smash','jump'].includes(type)?2.0+g.power*1.7:['drive','push'].includes(type)?3.2+g.power*1.8")
s=s.replace("  const v=launch(0,type", "  if(type==='jump')jumpUntil=simTime+.6;\n  const v=launch(0,type")
s=s.replace("const direction=Math.abs(g.dx)>Math.abs(g.dy)?'횡방향 커팅':g.dy>24?'뒤로 당김':g.dy< -15?'전방 스윙':'짧은 탭';", "const gestureLabel=Math.abs(g.dx)>Math.abs(g.dy)?'좌우 / 사선':g.dy>24?'아래 드래그':g.dy< -15?'위 드래그':'약한 클릭';")
s=s.replace('`${direction} · ${g.duration', '`${gestureLabel} · ${g.duration')
s=s.replace("lastHit=i;rally++;", "lastHit=i;serviceFlight=false;if(i===1)incomingType=type;rally++;")
s=s.replace("shake=type==='smash'?3:1", "shake=['smash','jump'].includes(type)?3:1")
s=s.replace("  lastReplay=recording.slice();", "  serverIndex=winner;serviceFlight=false;\n  lastReplay=recording.slice();")
s=s.replace("p.x+=p.vx*dt;p.y+=p.vy*dt;", "p.x+=p.vx*dt;p.y+=p.vy*dt;p.stepPhase=(p.stepPhase||0)+Math.hypot(p.vx,p.vy)*dt*4.5;")
s=s.replace("  if(phase!=='playing')return;\n  players.forEach", "  if(phase==='service'&&serverIndex===1&&simTime>=nextServe)deliverService();\n  if(phase!=='playing')return;\n  players.forEach")
s=s.replace("endPoint(groundWinner(ball,lastHit),out?", "endPoint(serviceFlight&&!validServiceLanding(ball,service)?1-serverIndex:groundWinner(ball,lastHit),serviceFlight&&!validServiceLanding(ball,service)?'SERVICE FAULT · 대각선 서비스 구역 밖':out?")
s=s.replace("  if(phase==='playing'&&ball){", "  if(phase==='service'){$('timing-text').textContent=serverIndex===0?'클릭해서 대각선 서브':'NOVA 서브 준비';$('footwork').textContent='SERVICE · '+service.parity;}\n  if(phase==='playing'&&ball){")
s=s.replace("score:[...score],rally,lastHit", "score:[...score],serverIndex,service,serviceFlight,incomingType,rally,lastHit")
p.write_text(s,encoding='utf-8')
