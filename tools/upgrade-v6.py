from pathlib import Path
p=Path('renderer3d.js');s=p.read_text(encoding='utf8');a=s.index(' // 어두운 관중석.');b=s.index(' for(const x of [-3.05',a);s=s[:a]+" // 실험용 빈 경기장: 관중과 관중석 메시 제거.\n"+s[b:];p.write_text(s,encoding='utf8')
p=Path('game.js');s=p.read_text(encoding='utf8').replace('strokeTarget,serviceTarget}', 'strokeTarget,serviceTarget,judgeTiming,predictContactTime}')
# default once, respecting later explicit session setting changes
pos=s.index('function save()');s=s[:pos]+"if(!sessionStorage.getItem('shuttle-v6')){ui.difficulty.value='hard';ui.assist.checked=true;sessionStorage.setItem('shuttle-v6','1');}\nlet timingFeedback={text:'',until:0};\n"+s[pos:]
# Canvas fallback audience removed
a=s.index('  for(let row=6;row>=0;row--)');b=s.index("  polygon([[-13,-11",a);s=s[:a]+s[b:]
# render HUD at racket
s=s.replace('ctx.restore();drawGesture();','ctx.restore();drawGesture();updateTimingCue();')
pos=s.index('function drawGesture()')
s=s[:pos]+'''function contactMoment(){return hold&&swingContext().highReturn&&(performance.now()-hold.start)>.45*1000?players[0].jumpAt:players[0].contactAt;}
function updateTimingCue(){
 const cue=$('timing-cue'),incoming=phase==='playing'&&lastHit===1,feedback=timingFeedback.until>simTime;
 cue.hidden=!ui.assist.checked||(!incoming&&!feedback)||phase==='intro';if(cue.hidden)return;
 const jump=Math.sin(clamp((jumpUntil-simTime)/.6,0,1)*Math.PI)*.65;
 const pose=buildPose(players[0],simTime,{jump,charge:hold?clamp((performance.now()-hold.start)/850,0,1):0}),q=project(...pose.racket.tip);
 cue.style.left=clamp(q.x+20,12,W-105)+'px';cue.style.top=clamp(q.y-68,60,H-100)+'px';
 const remaining=(contactMoment()||simTime)-simTime,progress=clamp(1-(remaining+.2)/1.0,0,1);
 $('timing-circle').style.strokeDashoffset=String(126*(1-progress));
 const label=feedback?timingFeedback.text:remaining>.2?'준비':remaining<-.2?'늦음':Math.abs(remaining)<.05?'지금!':'스윙';
 $('timing-verdict').textContent=label;cue.dataset.grade=feedback?timingFeedback.text:Math.abs(remaining)<.05?'PERFECT':Math.abs(remaining)<=.12?'GOOD':'BAD';
 $('timing-countdown').textContent=feedback?'타이밍 판정':remaining>0?remaining.toFixed(2)+'초':'타점 통과';
}
function timingResult(grade){timingFeedback={text:grade,until:simTime+1.35};$('last-grade').textContent=grade;}
''' +s[pos:]
# Korean announcements every gameplay branch
replacements={"'PAUSED'":"'일시정지'","'YOUR SERVICE'":"'나의 서브'","'NOVA SERVICE'":"'상대 서브'","'SHORT SERVICE'":"'숏 서브'","'LONG SERVICE'":"'롱 서브'","'NEXT FEED'":"'다음 연습구'","'YOUR POINT'":"'나의 득점'","'NOVA POINT'":"'상대 득점'","'REPLAY'":"'다시 보기'","'REPLAY END'":"'다시 보기 종료'"}
for a,b in replacements.items():s=s.replace(a,b)
s=s.replace('announce(SHOTS[type].label,','announce(SHOTS[type].name,').replace("announce('NOVA · '+SHOTS[type].label,","announce('상대 · '+SHOTS[type].name,")
# remove reserved-swing feature, release judged once
a=s.index("  pending={metrics,expires:");b=s.index("\n});",a)
s=s[:a]+'''  pending={metrics};showMetrics(metrics);
  const moment=['jump','jumpDrop'].includes(classify(metrics,ball.z,ball.y,swingContext()))?players[0].jumpAt:players[0].contactAt;
  const error=simTime-(moment||simTime),grade=judgeTiming(error,canHit(0));timingResult(grade);
  if(grade==='MISS'){
    players[0].swing=simTime;players[0].shotType=classify(metrics,ball.z,ball.y,swingContext());
    $('last-feedback').textContent=`헛스윙 · ${error>0?'늦은':'이른'} 타이밍 ${Math.abs(error).toFixed(2)}초. 상대 득점입니다.`;
    pending=null;endPoint(1,'헛스윙 · 타이밍을 놓쳤습니다');return;
  }
  hitPlayer();''' +s[b:]
s=s.replace("const height=ball.z,dist=Math.hypot(ball.x-players[0].x,ball.y-players[0].y),grade=dist<.55&&height>1.2?'CLEAN CONTACT':'IN REACH';","const height=ball.z,grade=timingFeedback.text;")
s=s.replace("${ui.assist.checked?' (타이밍 보조)':''}"," · ${grade}")
# forecasts at each opponent hit / feed
s=s.replace("if(i===0){p.target=predictIntercept(ball,p.side,p);p.react=simTime+.12;return;}","if(i===0){p.target=predictIntercept(ball,p.side,p);p.react=simTime+.12;p.contactAt=simTime+predictContactTime(ball,-1);p.jumpAt=simTime+predictContactTime(ball,-1,3.0);return;}")
s=s.replace("(ui.difficulty.value==='easy'?.36:.25)","(ui.difficulty.value==='hard'?.14:ui.difficulty.value==='easy'?.36:.25)")
s=s.replace("(i===1?.8:1.05)","(i===1?(ui.difficulty.value==='hard'?1.0:.8):1.05)")
s=s.replace("(ui.difficulty.value==='easy'?.78:.9)","(ui.difficulty.value==='hard'?1.12:ui.difficulty.value==='easy'?.78:.9)")
s=s.replace("(ui.difficulty.value==='easy'?.17:.08)","(ui.difficulty.value==='hard'?.02:ui.difficulty.value==='easy'?.17:.08)")
s=s.replace("const difficulty=ui.difficulty.value==='easy'?.7:1;","const difficulty=ui.difficulty.value==='hard'?1.25:ui.difficulty.value==='easy'?.7:1;")
# pending tick is obsolete
a=s.index('  if(pending){if(pending.expires');b=s.index('  if(lastHit===0',a);s=s[:a]+s[b:]
s=s.replace("reachable?'지금 놓으세요!':pending?'스윙 예약됨 · 타점으로 이동':incoming?'셔틀을 보며 스윙을 준비하세요'","reachable?'원형 게이지를 보고 놓으세요!':incoming?'라켓 위 원형 게이지에 타이밍을 맞추세요'")
p.write_text(s,encoding='utf8')
p=Path('index.html');s=p.read_text(encoding='utf8').replace('v0.5 · 3D COURTSIDE','v0.6 · TIMING TEST').replace('BUILD 005 · 3D 선수 · 플랫 궤적 · AI 리딩','BUILD 006 · 엄격한 타이밍 · 드래그 길이 판정')
s=s.replace('<div class="shout">','<div class="timing-cue" id="timing-cue" hidden><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" class="ring-base"/><circle cx="24" cy="24" r="20" id="timing-circle"/></svg><b id="timing-verdict">준비</b><small id="timing-countdown"></small></div><div class="shout">')
s=s.replace('타이밍 보조 <input','타이밍 게이지 <input').replace('놓은 스윙을 최대 0.9초 기억해 타점에서 실행합니다.','시각 보조만 제공합니다. 늦거나 닿지 않는 스윙은 헛스윙으로 실점합니다.').replace('<option value="easy">','<option value="hard" selected>높음 · 실험용</option><option value="easy">')
s=s.replace('강한 사선: 스매시 · 약한 사선: 드롭','72px 이상: 스매시 · 미만: 드롭').replace('0.45초 홀드 후 강하게 / 약하게 아래로','0.45초 홀드 후 길게 / 짧게 아래로').replace('빠르게 스매시 · 천천히 드롭','길게 스매시 · 짧게 드롭').replace('빠르게 스매시 · 천천히 드롭','길게 스매시 · 짧게 드롭').replace('짧게 클릭','짧게 클릭')
s=s.replace('타이밍 보조 ON을 추천해요','원형 타이밍 게이지를 보고 놓으세요').replace('빠르게 스매시 · 천천히 드롭','길게 스매시 · 짧게 드롭')
p.write_text(s,encoding='utf8')
# speed-based old assertions updated to new explicit length requirements
p=Path('tests/controls-v2.test.mjs');s=p.read_text(encoding='utf8').replace("classify(g(0,90,120),2.7,-4),'drop'","classify(g(0,30,120),2.7,-4),'drop'");p.write_text(s,encoding='utf8')
p=Path('tests/v4.test.mjs');s=p.read_text(encoding='utf8').replace("g(-90,90,120)","g(-20,25,120)").replace("g(-60,90,120,.7)","g(-20,25,120,.7)");p.write_text(s,encoding='utf8')
