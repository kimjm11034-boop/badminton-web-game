import {createImpactAudio} from './impact-audio.js';
import {recordShot} from '../lobby/progress.js';
import {defaults,createMatch,shotNames} from './simulation.js';
import {createCourt} from './court.js';
import {career,recordResult,tiers,winsToPromote,promotionMatch,selectable} from './ranks.js';
import {clamp,timingRadius} from '../physics.js';
const $=id=>document.getElementById(id),canvas=$('court'),settings={...defaults},keys=new Set();
const controls=[
 ['sensitivity','마우스 감도',.25,2.5,.05,'×'],['swingLook','스윙 중 시점 감도',.05,.8,.05,'×'],['volume','타구 음량',0,1,.05,'×'],['eye','눈높이',1.35,2.05,.01,'m'],['pitch','네트 기준 시선 각도',-12,18,.5,'°'],['fov','시야각',48,100,1,'°'],
 ['width','코트 폭',4.8,8,.05,'m'],['length','코트 길이',10,17,.1,'m'],['bird','콕 표시 크기',.85,2.8,.05,'×'],['arc','포핸드 스윙 폭',.55,1.6,.05,'×'],['backArc','백핸드 스윙 폭',.55,1.6,.05,'×']
];
try{const saved=JSON.parse(localStorage.getItem('astra-doubles-settings')||'{}');for(const [k,,lo,hi] of controls)if(Number.isFinite(saved[k]))settings[k]=clamp(saved[k],lo,hi);}catch{}
const practice=new URLSearchParams(location.search).get('mode')==='practice';
let progress={rank:0,wins:0},matchId=null,playedRank=0,account=null,saveFailed=false;
try{progress=career(localStorage);}catch{}
// Signed-in players keep their tier on the account; guests keep it in this browser.
async function accountCall(action,body){
 const r=await fetch('/api/account/'+action,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
 if(!r.headers.get('Content-Type')?.includes('application/json'))throw Error('offline');
 const data=await r.json();if(!r.ok)throw Error(data.error||'계정 요청 실패');return data.user;
}
async function saveResult(id,rank,won){
 if(!account){try{return recordResult(localStorage,id,rank,won);}catch{return progress;}}
 try{account=await accountCall('result',{match:id,rank,won});return account.standing;}
 catch{saveFailed=true;return progress;}
}
const difficulty=$('difficulty');
let chosen=progress.rank;
function setChosen(rank){
 chosen=rank;$('pick-name').textContent=tiers[rank].name;$('pick-index').textContent=String(rank+1).padStart(2,'0');refreshRank();
}
// "승급전" shows only at 9/10 wins, when the next win promotes.
function refreshRank(){
 const status=$('rank-status'),top=progress.rank===tiers.length-1;
 const text=practice?['AI 연습 · 원하는 난이도로 훈련 · 승급 집계 없음']:[
  (account?account.name:'게스트')+' · 내 등급 '+tiers[progress.rank].name,
  top?'최고 등급':progress.wins+'/'+winsToPromote+'승',
  ...(chosen<progress.rank?['하위 등급 대전 · 승급 집계 제외']:[]),
  ...(saveFailed?['마지막 결과를 계정에 저장하지 못했습니다']:[])
 ];
 status.replaceChildren(text.join(' · '));
 if(!practice&&chosen===progress.rank&&promotionMatch(progress)){
  const chip=document.createElement('b');chip.className='promo';chip.textContent='승급전';status.append(' ',chip);
 }
}
const bar=(label,value)=>`<span class="stat"><em>${label}</em><i style="--v:${Math.max(.06,Math.min(1,value)).toFixed(2)}"></i></span>`;
function renderTiers(){
 const list=$('tier-list');list.replaceChildren();
 $('tier-note').textContent=practice?'AI 연습은 모든 난이도를 고를 수 있습니다. 승급에는 집계되지 않습니다.':'내 등급 '+tiers[progress.rank].name+'부터 초심까지 고를 수 있습니다. 내 등급 경기만 승급에 집계됩니다.';
 tiers.forEach((tier,i)=>{
  const open=selectable(i,progress,practice),mine=!practice&&i===progress.rank,cleared=!practice&&i<progress.rank;
  const li=document.createElement('li'),row=document.createElement('button');
  row.type='button';row.className='tier-row'+(i===chosen?' chosen':'')+(mine?' mine':'');row.disabled=!open;
  const tag=!open?`<span class="tag locked"><svg aria-hidden="true" class="icon"><use href="/vendor/lucide/court.svg#lock"></use></svg>${tiers[i].name} 승급 후</span>`
   :mine?`<span class="tag mine">내 등급 · ${progress.wins}/${winsToPromote}</span>`:cleared?'<span class="tag">클리어</span>':'';
  row.innerHTML=`<span class="tier-index">${String(i+1).padStart(2,'0')}</span><span class="tier-copy"><strong>${tier.name}</strong><small>${tier.blurb}</small>`
   +`<span class="stats">${bar('속도',(tier.speed-2)/4.8)}${bar('반응',(.36-tier.reaction)/.35)}${bar('공격',tier.attack/.8)}</span></span>${tag}`
   +(i===chosen?'<svg aria-hidden="true" class="icon pick"><use href="/vendor/lucide/court.svg#check"></use></svg>':'');
  if(open)row.onclick=()=>{setChosen(i);dismiss(false);};
  li.append(row);list.append(li);
 });
}
difficulty.onclick=()=>{renderTiers();panel('difficulty');document.querySelector('.tier-row.chosen')?.focus();};
setChosen(chosen);
accountCall('me').then(user=>{
 if(!user?.standing)return;
 account=user;const followed=chosen===progress.rank;progress=user.standing;
 if(!matchId&&(followed||!selectable(chosen,progress,practice)))setChosen(progress.rank);else refreshRank();
}).catch(()=>{});
const game=createMatch(settings,Math.random,practice),s=game.s;game.start();s.phase='ready';
if(practice){
 document.title='AI 연습 · Minton Web Game';
 $('intro').querySelector('h1').textContent='AI 연습';
 $('intro').querySelector('p').textContent='AI의 서브를 받고 랠리를 이어가세요. 점수 없이 반복합니다.';
 document.querySelector('.score').hidden=true;
}
let court,held=null,paused=false,last=performance.now(),acc=0,lastHud=0,previousShot=null,menuOrigin=null;
function persist(){try{localStorage.setItem('astra-doubles-settings',JSON.stringify(settings));}catch{}}
function updateSettings(k,value){
 if(k==='width'||k==='length')game.resize(k==='width'?value:settings.width,k==='length'?value:settings.length);
 else settings[k]=value;
 const spec=controls.find(c=>c[0]===k);$('set-'+k).value=value;$('value-'+k).textContent=value.toFixed(spec[4]<1?2:0)+' '+spec[5];persist();
}
for(const [k,title,min,max,step,unit] of controls){
 const label=document.createElement('label'),out=document.createElement('output'),input=document.createElement('input');
 input.id='set-'+k;input.type='range';input.min=min;input.max=max;input.step=step;input.value=settings[k];input.setAttribute('aria-label',title);
 out.id='value-'+k;out.textContent=settings[k].toFixed(step<1?2:0)+' '+unit;label.append(title,out,input);$('sliders').append(label);
 input.oninput=()=>updateSettings(k,Number(input.value));
}
$('reset').onclick=()=>{for(const [k] of controls)updateSettings(k,defaults[k]);};
const audio=createImpactAudio(),menu=$('menu');
const active=()=>!['ready','over'].includes(s.phase);
const isLocked=()=>document.pointerLockElement===canvas;
function captureMouse(){
 if(!isLocked())try{canvas.requestPointerLock?.()?.catch(()=>{});}catch{}
}
function clearInput(){held=null;keys.clear();acc=0;}
function panel(which,origin=null){
 if(!court&&which==='pause')return;
 clearInput();paused=active();menuOrigin=origin;menu.dataset.panel=which;
 for(const [key,id] of [['settings','tuning'],['help','guides'],['pause','pause-view'],['difficulty','tier-view']])$(id).hidden=which!==key;
 $('drawer-title').textContent={settings:'경기 설정',help:'조작법',pause:'일시정지',difficulty:'상대 난이도'}[which];
 if(!menu.open)menu.showModal();
 if(isLocked())document.exitPointerLock();$('close').focus();hud();
}
function dismiss(grab=true){
 if(menuOrigin==='pause'){panel('pause');return;}
 if(menu.open)menu.close();
 paused=false;clearInput();canvas.focus({preventScroll:true});
 if(grab&&active())captureMouse();hud();
}
$('help').onclick=()=>panel('help');$('settings').onclick=()=>panel('settings');$('close').onclick=()=>dismiss();
$('pause').onclick=()=>panel('pause');$('resume').onclick=()=>dismiss();
for(const el of document.querySelectorAll('[data-panel]'))el.onclick=()=>panel(el.dataset.panel,'pause');
menu.addEventListener('cancel',e=>{e.preventDefault();dismiss(false);});
menu.addEventListener('click',e=>{if(e.target===menu){const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss();}});
function begin(){
 if(!court)return;
 if(menu.open)menu.close();menuOrigin=null;audio.activate();
 playedRank=chosen;matchId=Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
 game.start(playedRank);court.resetView();
 if(!practice)document.querySelector('.score-label').textContent=tiers[playedRank].name+' / 21점';
 previousShot=null;paused=false;clearInput();$('arena').classList.remove('lobby');$('intro').hidden=true;$('match-hud').hidden=false;
 $('pause').disabled=false;canvas.focus();captureMouse();hud();
}
$('start').onclick=begin;$('restart').onclick=begin;
document.addEventListener('pointerlockchange',()=>{if(!isLocked()&&active()&&!menu.open)panel('pause');});
function blurPause(){clearInput();if(active()&&!menu.open)panel('pause');}
window.addEventListener('blur',blurPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)blurPause();});
window.addEventListener('keydown',e=>{
 if(menu.open||e.ctrlKey||e.altKey||e.metaKey)return;
 if(e.code==='Escape'){if(active()){e.preventDefault();e.stopPropagation();panel('pause');}return;}
 if(!['serve','rally'].includes(s.phase)||paused)return;
 if(e.code==='KeyF'&&s.ball){court.faceShuttle(s.ball);return;}
 if(!['KeyW','KeyS','KeyA','KeyD','Space'].includes(e.code))return;
 e.preventDefault();if(e.code==='Space'){if(!e.repeat)game.jump();}else keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
canvas.oncontextmenu=e=>e.preventDefault();
function addDelta(dx,dy,t){
 if(!held||!Number.isFinite(dx+dy)||(!dx&&!dy))return;
 const last=held.points.at(-1);held.points.push({x:last.x+dx,y:last.y+dy,t});held.distance+=Math.hypot(dx,dy);
 court.look(dx*settings.swingLook,dy*settings.swingLook);
}
canvas.onpointerdown=e=>{
 if(menu.open||paused||!court||held||!['serve','rally'].includes(s.phase)||![0,2].includes(e.button))return;
 canvas.focus({preventScroll:true});audio.activate();
 if(!isLocked())canvas.setPointerCapture(e.pointerId);
 held={pointer:e.pointerId,hand:e.button===0?'back':'fore',button:e.button,start:e.timeStamp,points:[{x:0,y:0,t:e.timeStamp}],distance:0,x:e.clientX,y:e.clientY};
};
function moveView(e){
 if(!court||!active()||menu.open||paused)return;
 if(held){
  if(e.pointerId!==undefined&&held.pointer!==e.pointerId)return;
  const dx=isLocked()?e.movementX:e.clientX-held.x,dy=isLocked()?e.movementY:e.clientY-held.y;
  addDelta(dx,dy,e.timeStamp);held.x=e.clientX;held.y=e.clientY;
 }else court.look(e.movementX,e.movementY);
}
canvas.onpointermove=e=>{if(!isLocked())moveView(e);};
canvas.onmousemove=e=>{if(isLocked())moveView(e);};
canvas.onpointerup=e=>{
 if(!held||held.button!==e.button)return;
 if(!isLocked())addDelta(e.clientX-held.x,e.clientY-held.y,e.timeStamp);
 const g=held;held=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 game.swing(g.hand,g.points,Math.max(.012,(e.timeStamp-g.start)/1000));hud();
};
canvas.onpointercancel=()=>{held=null;};
canvas.onlostpointercapture=()=>{if(!isLocked())held=null;};
const map=$('map').getContext('2d');
function mini(){
 const W=150,H=178,w=Math.min(122,154*settings.width/settings.length),h=152,l=(W-w)/2,top=12;
 const point=(x,y)=>[75+x*w/settings.width,top+h*.5-y*h/settings.length];
 map.clearRect(0,0,W,H);map.fillStyle='#2d6555';map.fillRect(l,top,w,h);map.strokeStyle='#a4c5af';map.lineWidth=1.6;map.strokeRect(l,top,w,h);
 map.beginPath();for(const f of [.352,.5,.648]){map.moveTo(l,top+h*f);map.lineTo(l+w,top+h*f);}
 for(const v of [[0,.352],[.648,1]]){map.moveTo(75,top+h*v[0]);map.lineTo(75,top+h*v[1]);}map.stroke();
 for(const p of s.players){const [x,y]=point(p.x,p.y);map.fillStyle=['#d4ff83','#57d8d1','#ffb287','#ffb287'][p.id];map.beginPath();map.arc(x,y,p.id===0?6:4.5,0,Math.PI*2);map.fill();if(p.id===0){map.strokeStyle='white';map.stroke();}}
 if(s.ball){const [x,y]=point(s.ball.x,s.ball.y);map.fillStyle='white';map.fillRect(x-2,y-2,4,4);}
}
function hud(){
 $('ours').textContent=s.score[0];$('theirs').textContent=s.score[1];$('rally').textContent='RALLY '+String(s.rally).padStart(2,'0');
 $('call').textContent=paused?'일시정지':s.feedback;
 $('detail').textContent=paused?'Ⅱ 버튼 또는 Esc로 계속하기':s.phase==='serve'?(s.server===0?'클릭은 쇼트 서브 · 위로 드래그하면 롱 서브':'대각선 서비스 코트에서 준비하세요'):s.plan?.actor===1?'파트너가 받습니다':s.plan?.actor===0?'내 타구 · 콕을 따라 이동하세요':'파트너와 수비 위치를 잡으세요';
 if(s.lastShot){const sh=s.lastShot;$('last-shot').textContent=(sh.hand==='back'?'백핸드 ':'포핸드 ')+shotNames[sh.type];$('speed').textContent=Math.round(sh.speed)+' km/h'+(s.quality!==null?' · '+game.grade(sh.error):'');}
 else{$('last-shot').textContent='—';$('speed').textContent='';}
 if(s.phase==='over'&&matchId){
  const won=s.score[0]>s.score[1],previousRank=progress.rank,finished=matchId,rank=playedRank;
  matchId=null;clearInput();court.resetView();
  if(isLocked())document.exitPointerLock();
  $('arena').classList.add('lobby');$('match-hud').hidden=true;$('intro').hidden=false;
  $('intro').querySelector('h1').textContent=won?'우리 팀 승리':'상대 팀 승리';
  const summary=s.score.join(' : ')+' · '+tiers[rank].name;
  $('intro').querySelector('p').textContent=summary;
  saveResult(finished,rank,won).then(next=>{
   progress=next;const promoted=progress.rank>previousRank;
   if(promoted){$('intro').querySelector('p').textContent=summary+' · '+tiers[progress.rank].name+' 승급!';setChosen(progress.rank);}
   refreshRank();
  });
  $('start').querySelector('span').textContent='다시 경기';$('pause').disabled=true;
 }
 const me=s.players[0];mini();
 const clock=$('serve-clock');clock.hidden=menu.open||s.phase!=='serve'||s.server<2;
 if(!clock.hidden)clock.querySelector('b').textContent=Math.ceil(Math.max(0,s.deadline-s.time));
 if(s.lastShot&&previousShot!==s.lastShot){previousShot=s.lastShot;recordShot(s.lastShot,s.rally);audio.strike(s.lastShot,me,s.players[s.lastShot.id].hit,court?.yaw||0,settings.volume);}

}
function gauge(){
 const locator=$('locator');locator.hidden=true;
 if(s.ball&&s.phase==='rally'&&!paused){
  const q=court.project(s.ball);
  if(q.behind||Math.abs(q.x)>.94||Math.abs(q.y)>.90){
   const az=q.behind&&Math.abs(q.ax)<.01?1:q.ax, angle=Math.atan2(az,q.ay);
   locator.style.left=(50+43*Math.sin(angle))+'%';locator.style.top=(50-34*Math.cos(angle))+'%';locator.firstElementChild.style.transform='rotate('+angle+'rad)';locator.hidden=false;
  }
 }
 const cue=$('cue'),error=game.timing();cue.hidden=true;if(!s.ball||error===null||error<-.85||error>.55||paused)return;
 const uv=court.project(s.ball);if(!uv.visible||Math.abs(uv.x)>.99||Math.abs(uv.y)>.99)return;
 cue.hidden=false;cue.style.left=((uv.x+1)*50)+'%';cue.style.top=((1-uv.y)*50)+'%';$('ring').setAttribute('r',timingRadius(error));
}
function frame(time){
 const dt=Math.min(.09,(time-last)/1000);last=time;
 if(!paused){acc+=dt;while(acc>=1/120){const x=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),y=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),c=Math.cos(court.yaw),sn=Math.sin(court.yaw);
 game.tick(1/120,{x:x*c-y*sn,y:x*sn+y*c});acc-=1/120;}}
 court.render(s,held);gauge();if(time-lastHud>45){hud();lastHud=time;}requestAnimationFrame(frame);
}
try{court=await createCourt(canvas,settings);$('start').disabled=false;$('start').querySelector('span').textContent='경기 시작';hud();requestAnimationFrame(frame);}
catch(e){$('intro').querySelector('p').textContent='3D 코트를 열지 못했습니다. '+e.message;$('start').querySelector('span').textContent='다시 불러오기';$('start').disabled=false;$('start').onclick=()=>location.reload();console.error(e);}
window.shuttleLab={snapshot:()=>structuredClone({phase:s.phase,paused,score:s.score,players:s.players,server:s.server,receiver:s.receiver,last:s.last,lastShot:s.lastShot,plan:s.plan,ball:s.ball,feedback:s.feedback,rally:s.rally,swings:s.swings,time:s.time,settings,actors:court?.actorCount,yaw:court?.yaw,pitch: court?.pitch,audioReady:audio.ready,impacts:audio.played,serveRemaining:s.phase==='serve'?s.deadline-s.time:null}),project:p=>court?.project(p)};
