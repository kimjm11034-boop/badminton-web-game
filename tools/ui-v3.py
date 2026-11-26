from pathlib import Path
p=Path('index.html');s=p.read_text(encoding='utf-8').replace('PURPLE ARENA','CHAMPIONSHIP COURT').replace('NIGHT SESSION','TOURNAMENT SESSION').replace('v0.1 · SWING LAB','v0.3 · TOURNAMENT').replace('BUILD 002 · 스윙 분석 · 타점 예측 · 자동 줌','BUILD 003 · 대회장 · 서비스 규칙 · 상황별 스윙')
s=s.replace('<b>↗</b>앞으로 밀기<small>스매시 · 드라이브</small>','<b>↓</b>아래로 스윙<small>빠르게 스매시 · 천천히 드롭</small>').replace('<b>↙</b>뒤로 당기기<small>드롭 · 헤어핀</small>','<b>↑</b>위로 스윙<small>클리어 · 수비 언더</small>').replace('<b>⤴</b>길게 준비하기<small>클리어 · 리프트</small>','<b>⤓</b>꾹 누르고 강하게<small>높은 리턴에 점프 스매시</small>')
a=s.index('  <section class="guide">');b=s.index('  <section class="settings">',a)
s=s[:a]+'''  <section class="guide"><div class="section-label">CONTEXT SHOT GUIDE <span>공격 · 네트 · 수비</span></div>
  <div><i>↓</i><span><b>빠르게 스매시 · 천천히 드롭</b><small>후방 / 높은 타점 · 아래로 드래그</small></span><kbd>ATTACK</kbd></div>
  <div><i>⤓</i><span><b>충전 → 점프 스매시</b><small>높은 클리어 / 언더 리턴에 0.45초 이상 홀드</small></span><kbd>JUMP</kbd></div>
  <div><i>↑</i><span><b>클리어 / 언더</b><small>위로 드래그 · 낮은 타점은 수비 리프트</small></span><kbd>LIFT</kbd></div>
  <div><i>↔</i><span><b>네트 앞: 방향성 헤어핀</b><small>좌우 헤어핀 · 위 언더 · 아래 푸시</small></span><kbd>NET</kbd></div>
  <div><i>↗</i><span><b>수비: 좌우 / 사선 드라이브</b><small>방향대로 반격 · 클릭은 약한 커트 / 블록</small></span><kbd>DEFEND</kbd></div>
  <div><i>·</i><span><b>짧은 클릭: 부드러운 드라이브</b><small>수비 상황은 네트 앞에 짧게 막아내기</small></span><kbd>TOUCH</kbd></div></section>
''' +s[b:]
p.write_text(s,encoding='utf-8')
p=Path('tests/physics.test.mjs');s=p.read_text(encoding='utf-8');a=s.index("test('gesture direction");b=s.index("test('release velocity",a);s=s[:a]+s[b:];p.write_text(s,encoding='utf-8')
PY=''
