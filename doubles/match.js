import {defaults,createMatch,shotNames} from './simulation.js';
import {createCourt} from './court.js';
import {clamp,timingRadius} from '../physics.js';
const $=id=>document.getElementById(id),canvas=$('court'),settings={...defaults},keys=new Set();
const controls=[
 ['eye','눈높이',1.35,2.05,.01,'m'],['pitch','네트 기준 시선 각도',-12,18,.5,'°'],['fov','시야각',48,100,1,'°'],
 ['width','코트 폭',4.8,8,.05,'m'],['length','코트 길이',10,17,.1,'m'],['bird','콕 표시 크기',.85,2.8,.05,'×'],['arc','포핸드 스윙 폭',.55,1.6,.05,'×'],['backArc','백핸드 스윙 폭',.55,1.6,.05,'×']
];
try{const saved=JSON.parse(localStorage.getItem('astra-doubles-settings')||'{}');for(const [k,,lo,hi] of controls)if(Number.isFinite(saved[k]))settings[k]=clamp(saved[k],lo,hi);}catch{}
const game=createMatch(settings),s=game.s;game.start();s.phase='ready';
let court,held=null,paused=false,lastEvent=-1,last=performance.now(),acc=0,lastHud=0,audio,muted=false;
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
function panel(which){
 const open=which&&($('drawer').hidden||$('drawer').dataset.panel!==which);
 $('drawer').hidden=!open;$('drawer').dataset.panel=open?which:'';$('tuning').hidden=which!=='settings';$('guides').hidden=which!=='help';
 $('drawer-title').textContent=which==='settings'?'경기 설정':'마우스 스윙 조작';for(const k of ['help','settings'])$(k).setAttribute('aria-expanded',String(!!open&&k===which));
 if(!open)canvas.focus({preventScroll:true});
}
$('help').onclick=()=>panel('help');$('settings').onclick=()=>panel('settings');$('close').onclick=()=>panel(null);
function tone(hit){
 if(muted||!audio||audio.state!=='running')return;
 const osc=audio.createOscillator(),amp=audio.createGain(),t=audio.currentTime;osc.type='triangle';
 osc.frequency.setValueAtTime(hit?910:420,t);osc.frequency.exponentialRampToValueAtTime(hit?220:550,t+.06);
 amp.gain.setValueAtTime(hit?.10:.045,t);amp.gain.exponentialRampToValueAtTime(.0002,t+.09);osc.connect(amp);amp.connect(audio.destination);osc.start(t);osc.stop(t+.10);
}
function begin(){
 if(!court)return;
 try{audio??=new AudioContext();audio.resume().catch(()=>{});}catch{}
 game.start();paused=false;held=null;keys.clear();$('intro').hidden=true;$('match-hud').hidden=false;$('pause').disabled=false;$('pause').textContent='Ⅱ';panel(null);canvas.focus();hud();
}
$('start').onclick=begin;$('restart').onclick=begin;
function pause(on){if(!court||['ready','over'].includes(s.phase))return;paused=on;keys.clear();held=null;acc=0;
 $('pause').textContent=on?'▶':'Ⅱ';$('pause').setAttribute('aria-label',on?'계속하기':'일시정지');if(!on)canvas.focus();hud();}
$('pause').onclick=()=>pause(!paused);
function release(){held=null;keys.clear();}
window.addEventListener('blur',()=>{release();if(!document.hasFocus())pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){release();pause(true);}});
window.addEventListener('keydown',e=>{
 if(e.code==='Escape'){if(!$('drawer').hidden)panel(null);else pause(!paused);return;}
 if(e.ctrlKey||e.altKey||e.metaKey||!['KeyW','KeyS','KeyA','KeyD','Space'].includes(e.code)||paused||!['serve','rally'].includes(s.phase))return;
 e.preventDefault();if(e.code==='Space'){if(!e.repeat)game.jump();}else keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
canvas.oncontextmenu=e=>e.preventDefault();
function addPoint(e){
 const p={x:e.clientX,y:e.clientY,t:e.timeStamp},last=held.points.at(-1);
 if(last){const d=Math.hypot(last.x-p.x,last.y-p.y);if(d<.6)return;held.distance+=d;}
 held.points.push(p);
}
canvas.onpointerdown=e=>{
 if(paused||!court||held||!['serve','rally'].includes(s.phase)||![0,2].includes(e.button))return;
 e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
 held={pointer:e.pointerId,hand:e.button===0?'back':'fore',button:e.button,start:e.timeStamp,points:[],distance:0};addPoint(e);
};
canvas.onpointermove=e=>{if(held?.pointer===e.pointerId)for(const p of e.getCoalescedEvents?.().length?e.getCoalescedEvents():[e])addPoint(p);};
canvas.onpointerup=e=>{
 if(held?.pointer!==e.pointerId||held.button!==e.button)return;addPoint(e);const g=held;held=null;
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 game.swing(g.hand,g.points,Math.max(.012,(e.timeStamp-g.start)/1000));hud();
};
canvas.onpointercancel=canvas.onlostpointercapture=()=>{held=null;};
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
 if(s.phase==='over'){$('intro').hidden=false;$('intro').querySelector('h1').textContent=s.score[0]>s.score[1]?'우리 팀 승리':'상대 팀 승리';$('intro').querySelector('p').textContent=s.score.join(' : ');$('start').textContent='다시 경기';$('pause').disabled=true;}
 const me=s.players[0];$('position').textContent='내 위치  '+me.x.toFixed(1)+' / '+(-me.y).toFixed(1)+' m';mini();
 if(s.event!==lastEvent){if(lastEvent>=0&&s.phase==='rally'&&s.lastShot?.at===s.players[s.last].swing&&s.time-s.lastShot.at<.09)tone(true);else if(s.phase==='point')tone(false);lastEvent=s.event;}
}
function gauge(){
 const cue=$('cue'),error=game.timing();cue.hidden=true;if(!s.ball||error===null||error<-.85||error>.55||paused)return;
 const uv=court.project(s.ball);if(!uv.visible||Math.abs(uv.x)>.99||Math.abs(uv.y)>.99)return;
 cue.hidden=false;cue.style.left=((uv.x+1)*50)+'%';cue.style.top=((1-uv.y)*50)+'%';$('ring').setAttribute('r',timingRadius(error));
}
function frame(time){
 const dt=Math.min(.09,(time-last)/1000);last=time;
 if(!paused){acc+=dt;while(acc>=1/120){game.tick(1/120,{x:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),y:Number(keys.has('KeyW'))-Number(keys.has('KeyS'))});acc-=1/120;}}
 court.render(s,held);gauge();if(time-lastHud>45){hud();lastHud=time;}requestAnimationFrame(frame);
}
try{court=await createCourt(canvas,settings);$('start').disabled=false;$('start').textContent='경기 시작  ↗';hud();requestAnimationFrame(frame);}
catch(e){$('intro').querySelector('p').textContent='3D 코트를 열지 못했습니다. '+e.message;$('start').textContent='다시 불러오기';$('start').disabled=false;$('start').onclick=()=>location.reload();console.error(e);}
window.shuttleLab={snapshot:()=>structuredClone({phase:s.phase,paused,score:s.score,players:s.players,server:s.server,receiver:s.receiver,last:s.last,lastShot:s.lastShot,plan:s.plan,ball:s.ball,feedback:s.feedback,rally:s.rally,swings:s.swings,time:s.time,settings,actors:court?.actorCount}),project:p=>court?.project(p)};
