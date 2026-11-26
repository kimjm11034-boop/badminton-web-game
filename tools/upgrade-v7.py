from pathlib import Path
p=Path('game.js');s=p.read_text(encoding='utf8').replace('judgeTiming,predictContactTime}', 'judgeTiming,predictContactTime,timingRadius}')
s=s.replace("let timingFeedback={text:'',until:0};", "let timingFeedback={text:'',until:0,error:0};")
a=s.index(' const remaining=(contactMoment()');b=s.index('\nfunction drawGesture()',a)
s=s[:a]+''' const moment=contactMoment()||simTime,error=feedback?timingFeedback.error:simTime-moment;
 const radius=timingRadius(error)*1.2;
 $('timing-circle').setAttribute('r',String(radius));
 const grade=judgeTiming(error);$('timing-verdict').textContent=feedback?timingFeedback.text:Math.abs(error)<.08?'지금!':error<0?'원에 맞춰 놓기':'조금 늦었어요';
 cue.dataset.grade=feedback?timingFeedback.text:grade;
 $('timing-countdown').textContent=feedback?'타이밍 피드백':error<0?(-error).toFixed(2)+'초':'다음 타점 준비';
}
function timingResult(grade,error=0){timingFeedback={text:grade,until:simTime+1.35,error};$('last-grade').textContent=grade;}
''' +s[b:]
a=s.index('  pending={metrics};showMetrics');b=s.index('\n});',a)
s=s[:a]+'''  const moment=['jump','jumpDrop'].includes(classify(metrics,ball.z,ball.y,swingContext()))?players[0].jumpAt:players[0].contactAt;
  const error=simTime-(moment||simTime);timingResult(judgeTiming(error),error);
  pending={metrics,expires:simTime+.9};showMetrics(metrics);
  if(canHit(0))hitPlayer();else $('gesture-state').textContent='QUEUED';''' +s[b:]
point=s.index('  if(lastHit===0&&ball.vz<1)aiHit();')
s=s[:point]+'''  if(pending){
    if(canHit(0))hitPlayer();
    else if(simTime>pending.expires){pending=null;$('gesture-state').textContent='READY';$('last-feedback').textContent='타점에 닿지 않았어요. 다시 스윙해 보세요. 즉시 실점은 없습니다.';}
  }
''' +s[point:]
s=s.replace("reachable?'원형 게이지를 보고 놓으세요!':incoming?", "reachable?'두 원이 겹칠 때 놓으세요!':pending?'스윙 기억 중 · 타점으로 이동':incoming?")
s=s.replace('q.x+20,12,W-105','q.x+16,12,W-108').replace('q.y-68,60,H-100','q.y-94,60,H-110')
p.write_text(s,encoding='utf8')
p=Path('index.html');s=p.read_text(encoding='utf8');a=s.index('  <div class="timing-cue"');b=s.index('<div class="shout">',a)
s=s[:a]+'''  <div class="timing-cue" id="timing-cue" hidden><svg viewBox="0 0 80 80" aria-hidden="true"><defs><radialGradient id="timing-growth"><stop offset="0%" stop-color="#73d7da" stop-opacity="0.08"/><stop offset="65%" stop-color="#99e9ad" stop-opacity="0.24"/><stop offset="100%" stop-color="#d3ff9a" stop-opacity="0.68"/></radialGradient></defs><circle cx="40" cy="40" r="24" class="timing-target"/><circle cx="40" cy="40" r="2.4" id="timing-circle"/></svg><b id="timing-verdict">원에 맞춰 놓기</b><small id="timing-countdown"></small></div>''' +s[b:]
s=s.replace('시각 보조만 제공합니다. 늦거나 닿지 않는 스윙은 헛스윙으로 실점합니다.','놓은 스윙을 최대 0.9초 기억합니다. 타이밍 판정으로 즉시 실점하지 않습니다.').replace('BUILD 006 · 엄격한 타이밍 · 드래그 길이 판정','BUILD 007 · 스윙 보조 복구 · 확장 원형 게이지').replace('v0.6 · TIMING TEST','v0.7 · CIRCLE TIMING')
p.write_text(s,encoding='utf8')
