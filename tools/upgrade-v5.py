from pathlib import Path
p=Path('game.js');s=p.read_text(encoding='utf8')
s="import {createArena3D} from './renderer3d.js';\n"+s
pos=s.index('const ui=');s=s[:pos]+"let arena3d=null;try{arena3d=createArena3D(canvas.parentElement);}catch(error){console.warn('WebGL fallback',error);}\n"+s[pos:]
s=s.replace("function project(x,y,z=0){const p=", "function project(x,y,z=0){if(arena3d)return arena3d.project(x,y,z);const p=")
s=s.replace("canvas.height=H*dpr;const g=", "canvas.height=H*dpr;arena3d?.resize(W,H);const g=")
a=s.index('  drawStadium();drawAim();');b=s.index('  if(hold){ctx.strokeStyle=',a)
old=s[a:b]
s=s[:a]+'''  if(arena3d){
    ctx.clearRect(0,0,W,H);
    arena3d.render({players,time:simTime,ball,trail,view,charge:hold?clamp((performance.now()-hold.start)/850,0,1):0,jump:Math.sin(clamp((jumpUntil-simTime)/.6,0,1)*Math.PI)*.65});
    drawAim();
  }else{
''' +old+'''  }
''' +s[b:]
# delayed observation: no exact destination until visual reaction
pos=s.index('function launch(')
s=s[:pos]+'''function planReception(i){
 const p=players[i];
 if(i===0){p.target=predictIntercept(ball,p.side,p);p.react=simTime+.12;return;}
 p.target={x:p.x*.5,y:3.45};p.react=simTime+.12;
 p.readAt=simTime+(ui.difficulty.value==='easy'?.36:.25);
 p.intent='WAIT / READ';
}
''' +s[pos:]
s=s.replace("players[1-serverIndex].target=predictIntercept(ball,players[1-serverIndex].side,players[1-serverIndex]);players[1-serverIndex].react=simTime+.12;", "planReception(1-serverIndex);")
s=s.replace("players[1-i].target=predictIntercept(ball,players[1-i].side,players[1-i]);players[1-i].react=simTime+.12;", "planReception(1-i);")
s=s.replace("Math.hypot(ball.x-p.x,ball.y-p.y)<1.05", "Math.hypot(ball.x-p.x,ball.y-p.y)<(i===1?.8:1.05)")
s=s.replace("const maxSpeed=dy*p.side>0?4.4:5.4;", "const maxSpeed=(dy*p.side>0?4.4:5.4)*(i===1?(ui.difficulty.value==='easy'?.78:.9):1);")
s=s.replace("  players.forEach((p,i)=>{movePlayer", "  const ai=players[1];if(lastHit===0&&ai.readAt&&simTime>=ai.readAt){ai.target=predictIntercept(ball,ai.side,ai);ai.target.x+=(ui.difficulty.value==='easy'?.17:.08)*Math.sin(simTime*5);ai.readAt=0;ai.intent=ball.z>3?'RECOVER DEEP':ball.z>1.5?'INTERCEPT':'LUNGE';}\n  players.forEach((p,i)=>{movePlayer")
s=s.replace('if(trail.length>12)trail.shift()', 'if(trail.length>55)trail.shift()')
s=s.replace("phase,paused,score:[...score]", "renderer:arena3d?'WebGL 3D':'Canvas fallback',phase,paused,score:[...score]")
p.write_text(s,encoding='utf8')
p=Path('server.mjs');s=p.read_text(encoding='utf8').replace("'motion.js']","'motion.js', 'renderer3d.js', 'vendor/three.module.js', 'vendor/three.core.js', 'data/footwork-reference.json', 'data/pose-contact-sheet.jpg']");s=s.replace("'.json': 'application/json'", "'.json': 'application/json', '.jpg':'image/jpeg'");p.write_text(s,encoding='utf8')
p=Path('index.html');s=p.read_text(encoding='utf8').replace('v0.4 · MOTION & SWING','v0.5 · 3D COURTSIDE').replace('BUILD 004 · 관절 IK · 스윙 코스 · 숏/롱 서브','BUILD 005 · 3D 선수 · 플랫 궤적 · AI 리딩');p.write_text(s,encoding='utf8')
