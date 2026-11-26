import {clips} from './clips.js';
import {evaluatePose} from './rig.js';
import {createStage,cameraNames} from './stage.js';
import {model,learnedPose,sampleAt} from './learned-rig.js';
import {createCatalog} from './catalog-ui.js';

const $=s=>document.querySelector(s);
const photoInset=document.createElement('figure');
photoInset.className='photo-inset';photoInset.append($('.record-img'));
const photoCaption=document.createElement('figcaption');photoInset.append(photoCaption);$('#stage').append(photoInset);
$('#study-scores').textContent='몸통 4점의 2D 평균 오차는 검증 '+model.centerline.testPeople.toLocaleString()+'개 선수 표본에서 박스 높이의 '+(100*model.centerline.meanErrorBoxHeight).toFixed(2)+'%입니다. 3D 복원과 단안 추정 기준 좌표의 평균 차이는 '+(100*model.stats.pseudoErrorM).toFixed(1)+' cm이며, 평균 자세를 사용하면 '+(100*model.stats.meanBaselineM).toFixed(1)+' cm입니다.';
const icons={
  cube:'<path d="m12 2 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10"/>',
  sliders:'<path d="M3 6h6m4 0h8M3 12h11m4 0h3M3 18h3m4 0h11"/><circle cx="11" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  activity:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  prev:'<path d="M5 5v14l12-7zM4 5v14" transform="rotate(180 11 12)"/><path d="M3 5v14"/>',
  next:'<path d="m6 5 11 7-11 7zM21 5v14"/>',
  loop:'<path d="M4 10V8a3 3 0 0 1 3-3h12m-3-3 3 3-3 3M20 14v2a3 3 0 0 1-3 3H5m3-3-3 3 3 3"/>',
  play:'<path d="m6 4 13 8-13 8z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M7 5v14M16 5v14" stroke-width="4"/>'
};
const icon=name=>'<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">'+icons[name]+'</svg>';
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
const dataLanding=!location.search.includes('authored');
const toggles={points:false,bones:false,names:false,contact:dataLanding,center:dataLanding};
const toggleNames={points:'관절점',bones:'뼈대',names:'관절 이름',contact:'발 접지',center:'무게중심'};
const pressed=(el,on)=>el.setAttribute('aria-pressed',String(on));
const library=clips;
const poseFor=(c,t)=>c.learned?learnedPose(c,t):evaluatePose(c,t,model.lengths);
let clip=clips.find(c=>c.id==='lunge'),t=clip.preview,playing=false,loop=true,rate=1,pose,dirty=true,stage,lastPhoto,catalog;
const labels={ready:'READY STANCE',split:'SPLIT STEP',shuffle:'SIDE CHASSÉ',cross:'CROSSOVER',lunge:'FRONT LUNGE',overhead:'OVERHEAD SWING',smash:'JUMP SMASH'};
function preview(canvas,c){
  canvas.width=128;canvas.height=84;
  const ctx=canvas.getContext('2d'),p=poseFor(c,c.preview);
  const points={};
  for(const [k,v] of Object.entries(p.j)){
    const a=v.x-p.j.pelvis.x,b=v.z-p.j.pelvis.z;
    points[k]=[a*.48-b*.87,-v.y+a*.07+b*.10];
  }
  const tip=p.j.handR.clone().addScaledVector(p.racketDir,.56),a=tip.x-p.j.pelvis.x,b=tip.z-p.j.pelvis.z;
  points.tip=[a*.48-b*.87,-tip.y+a*.07+b*.10];
  const xs=Object.values(points).map(p=>p[0]),ys=Object.values(points).map(p=>p[1]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),scale=Math.min(103/(xmax-xmin),69/(ymax-ymin));
  const xy=k=>[(points[k][0]-(xmax+xmin)/2)*scale+64,(points[k][1]-ymax)*scale+76];
  ctx.fillStyle='#e6e9df';ctx.fillRect(0,0,128,84);
  ctx.strokeStyle='#d5dbd0';ctx.lineWidth=1;for(let x=-8;x<125;x+=19){ctx.beginPath();ctx.moveTo(x,81);ctx.lineTo(x+7,73);ctx.stroke();}ctx.fillRect(0,76,128,1);
  function line(a,b,w,color){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...xy(a));ctx.lineTo(...xy(b));ctx.stroke();}
  for(const s of ['L','R']){
    line('ankle'+s,'knee'+s,4,'#65756c');line('knee'+s,'hip'+s,6,'#384e4c');line('ankle'+s,'toe'+s,4,'#a2ada0');
  }
  line('pelvis','chest',11,'#c37652');line('chest','neck',9,'#cd7851');const head=xy('head');ctx.fillStyle='#58615b';ctx.beginPath();ctx.ellipse(...head,3.7,4.5,0,0,Math.PI*2);ctx.fill();
  for(const s of ['L','R']){line('shoulder'+s,'elbow'+s,3.8,'#9f664e');line('elbow'+s,'hand'+s,3,'#ad816a');}
  if(!c.learned){line('handR','tip',1.4,'#485d53');const end=xy('tip'),hand=xy('handR');ctx.strokeStyle='#4f6961';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(end[0]*.85+hand[0]*.15,end[1]*.85+hand[1]*.15,2.8,4.5,Math.atan2(end[1]-hand[1],end[0]-hand[0])+Math.PI/2,0,Math.PI*2);ctx.stroke();}
}
function setPlaying(value){
  playing=value;
  $('#play').innerHTML=icon(value?'pause':'play');$('#play').setAttribute('aria-label',value?'일시정지':'재생');
}
function seek(value){t=Math.max(0,Math.min(1,value));setPlaying(false);dirty=true;}
function select(c,initial=false){
  const enteringData=!clip?.learned;
  clip=c;t=initial?c.preview:0;setPlaying(false);dirty=true;
  const unavailable=!!c.missing;
  const still=c.learned&&c.frames.length===1;
  $('#stage').classList.toggle('no-pose',unavailable);
  for(const el of document.querySelectorAll('#play,#scrub,#prev,#next,#loop,[data-rate]'))el.disabled=!!still||unavailable;
  $('#export').disabled=unavailable;
  if(!unavailable)stage?.frameClip(Array.from({length:still?1:41},(_,i)=>poseFor(c,i/40)));
  const sourceButton=document.querySelector('[data-view=source]');sourceButton.hidden=!c.learned;sourceButton.disabled=unavailable;
  if(c.learned&&!unavailable&&(enteringData||stage?.camera.mode==='source'))stage?.view('source',c.comparison);
  if(!c.learned&&stage?.camera.mode==='source')stage.view('orbit');
  document.querySelectorAll('.clip').forEach(b=>pressed(b,b.dataset.id===c.id));
  $('#scene-code').textContent=c.learned?[c.code,c.camera,c.source?.split('_')[1]].filter(Boolean).join('  /  '):'CLIP '+String(clips.indexOf(c)+1).padStart(2,'0')+'  /  '+labels[c.id];
  pressed($('#tab-data'),!!c.learned);pressed($('#tab-authored'),!c.learned);
  document.querySelectorAll('.clip').forEach(b=>b.hidden=(b.dataset.family==='data')!==!!c.learned);
  $('#record').hidden=!c.learned;photoInset.hidden=!c.learned;lastPhoto=null;
  $('#model-info').textContent=c.learned?'장면 코드는 촬영 구간의 원본 표기입니다. 한 장면에 타격 선수와 대기 선수가 함께 있을 수 있습니다. 카메라를 바꾸면 해당 카메라의 실제 촬영 사례를 봅니다.':'7개 제작 모션에 경기 데이터에서 구한 팔·다리 길이 비율을 적용합니다.';
  $('#scene-name').textContent=c.name;
  $('#phases').replaceChildren();$('#ticks').replaceChildren();
  for(const ph of c.phases){
    const b=document.createElement('button');b.textContent=ph.name;b.onclick=()=>seek(ph.at);$('#phases').append(b);
    const tick=document.createElement('i');tick.style.left=ph.at*100+'%';$('#ticks').append(tick);
  }
}
for(const c of library){
  const b=document.createElement('button');b.className='clip';b.dataset.id=c.id;b.dataset.family=c.learned?'data':'authored';
  const i=clips.indexOf(c);
  b.innerHTML='<canvas aria-hidden="true"></canvas><span><span class="clip-name">'+c.name+'</span><small class="clip-meta">'+c.group+' · '+(c.learned?c.frames.length+'장':c.duration.toFixed(2)+' s')+'</small></span><span class="clip-num">'+String(i+1).padStart(2,'0')+'</span>';
  preview(b.firstChild,c);b.onclick=()=>select(c);$('#clips').append(b);
}
$('#tab-data').onclick=()=>catalog.open();
$('#tab-authored').onclick=()=>{catalog.activate(false);select(clips.find(c=>c.id==='lunge'),true);};
for(const [id,name] of Object.entries(toggleNames)){
  const label=document.createElement('label');label.textContent=name;
  const input=document.createElement('input');input.type='checkbox';input.id='show-'+id;input.checked=toggles[id];
  input.onchange=()=>{toggles[id]=input.checked;dirty=true;};label.append(input);$('#toggles').append(label);
}
try{
  stage=createStage($('#stage'),(mode,zoom)=>{
    document.querySelectorAll('[data-view]').forEach(b=>pressed(b,b.dataset.view===mode));$('#view-info').textContent=(mode==='orbit'?'자유 궤도':cameraNames[mode]+' 시점')+' · '+zoom+'%';
  });
}catch(error){$('#stage-error').hidden=false;$('#stage-error').textContent='3D 화면을 열 수 없습니다. 브라우저의 그래픽 가속을 확인하세요.';console.error(error);}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{if(!clip.missing)stage?.view(b.dataset.view,clip.comparison);};
$('#zoom-in').onclick=()=>stage?.zoom(.88);$('#zoom-out').onclick=()=>stage?.zoom(1/.88);
for(const b of document.querySelectorAll('[data-rate]'))b.onclick=()=>{
  rate=Number(b.dataset.rate);document.querySelectorAll('[data-rate]').forEach(el=>pressed(el,el===b));
};
$('#scrub').oninput=e=>seek(Number(e.target.value)/1000);
$('#loop').onclick=()=>{loop=!loop;pressed($('#loop'),loop);};
$('#play').onclick=()=>{if(t>=1&&!playing)t=0;setPlaying(!playing);dirty=true;};
function step(direction){
  const phases=[...clip.phases.map(p=>p.at),1];
  seek(direction>0?(phases.find(v=>v>t+.0001)??1):(phases.findLast(v=>v<t-.0001)??0));
}
$('#prev').onclick=()=>step(-1);$('#next').onclick=()=>step(1);
const metrics=[['오른쪽 무릎','kneeR'],['왼쪽 무릎','kneeL'],['오른쪽 팔꿈치','elbowR'],['중심 높이','height'],['지지발','support']];
for(const [label,id] of metrics){
  const div=document.createElement('div');div.className='metric';div.innerHTML='<span>'+label+'</span><strong id="m-'+id+'"></strong>';$('#metrics').append(div);
}
function draw(){
  const editable=clip.learned&&clip.frames.length>0;
  $('#edit-current').hidden=!editable;
  if(editable){
    const member=(clip.missing?clip.frames[0]:sampleAt(clip,t).nearest).member;
    $('#edit-current').href='./review/?'+new URLSearchParams({track:clip.id,member});
  }
  if(clip.missing){
    const f=clip.frames[0];$('#scene-phase').textContent=clip.empty?'조건에 맞는 사례 없음':'관절 미검출';$('#frame-label').textContent=$('#scene-phase').textContent;
    $('#time').textContent=f?'원본 #'+f.index:'—';$('#record').hidden=!f;photoInset.hidden=!f;
    if(f){$('#source-photo').src=f.image;photoCaption.textContent='원본 전체 장면';$('#centerline').replaceChildren();$('#record-title').textContent='관절을 복원하지 못한 장면';$('#record-method').textContent='원본 프레임을 보존했습니다.';$('#record-id').textContent=f.member;}
    for(const el of document.querySelectorAll('#metrics strong'))el.textContent='—';
    $('#fill').style.width='0';$('#scrub').value=0;dirty=false;return;
  }
  pose=poseFor(clip,t);stage?.update(pose,toggles);
  const current=clip.phases.findLast(p=>p.at<=t);
  $('#scene-phase').textContent=current.name;[...$('#phases').children].forEach((b,i)=>{
    if(clip.phases[i]===current)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
  });
  $('#scrub').value=Math.round(t*1000);$('#fill').style.width=t*100+'%';
  $('#time').innerHTML=clip.learned?'원본 #'+sampleAt(clip,t).nearest.index+' · 총 '+clip.frames.length+'장':'<b>'+(t*clip.duration).toFixed(2)+'</b> / '+clip.duration.toFixed(2)+' s';
  for(const k of ['kneeR','kneeL','elbowR'])$('#m-'+k).textContent=pose.angles[k].toFixed(1)+'°';
  $('#m-height').textContent=pose.center.y.toFixed(3)+' m';
  $('#m-support').textContent=pose.feet.L.contact?(pose.feet.R.contact?'양발':'왼발'):(pose.feet.R.contact?'오른발':'공중');
  if(clip.learned){
    const f=sampleAt(clip,t).nearest,between=Math.abs(f.at-t)>.001;
    $('#scene-phase').textContent=between?'표본 사이 보간':'표본 '+f.index;
    $('#frame-label').textContent=between?'보간 자세':'원본 표본 '+f.index;
    $('#m-support').textContent+=' 후보';
    if(f!==lastPhoto){
      lastPhoto=f;$('#source-photo').src=f.image;
      photoCaption.textContent='원본 표본 #'+f.index;
      $('#record-title').textContent='가까운 원본 표본 '+f.index;
      $('#record-id').textContent=f.member;
      const methods={label:'공식 2D 관절 라벨',estimate:'MediaPipe 관절 추정',detector:'YOLO Pose 관절 추정',review:'사용자 확인 좌표 반영'};
      const count=f.method==='review'?Object.values(f.reviewPoints).filter(Boolean).length:12;
      $('#record-method').textContent=methods[f.method]+' '+count+'점 · 학습 모델로 3D 복원'+(f.world?' · 해당 사진의 깊이 추정 반영':'');
      const [x,y,r,b]=f.rect,svg=$('#centerline');svg.setAttribute('viewBox',[x,y,r-x,b-y].join(' '));svg.setAttribute('preserveAspectRatio','none');
      const links=[[0,1],[0,6],[1,7],[6,7],[0,2],[2,4],[1,3],[3,5],[6,8],[8,10],[7,9],[9,11]];
      svg.innerHTML=links.map(([a,b])=>'<line x1="'+f.input[a][0]+'" y1="'+f.input[a][1]+'" x2="'+f.input[b][0]+'" y2="'+f.input[b][1]+'" stroke="'+(a%2?'#ffb271':'#74e6df')+'" stroke-width="2"/>').join('')+'<polyline fill="none" stroke="#d1ff53" stroke-width="2.5" points="'+f.centerline.map(p=>p.join(',')).join(' ')+'"/>'+f.centerline.map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="3.2" fill="#dcff61" stroke="#35402b"/>').join('');
    }
  }else $('#frame-label').textContent='t = '+(t*clip.duration).toFixed(3)+' s';
  dirty=false;catalog?.bindLabel();
}
function frameData(){
  const p=poseFor(clip,t),s=clip.learned?sampleAt(clip,t):null;
  return {clip:clip.id,name:clip.name,seconds:clip.learned?null:t*clip.duration,normalizedTime:t,units:'m',axes:{x:'anatomical right at neutral',y:'up',z:clip.learned?'anatomical back in hip-local reconstruction':'away from net'},phase:$('#scene-phase').textContent,
    joints:Object.fromEntries(Object.entries(p.j).map(([k,v])=>[k,v.toArray()])),anglesDegrees:p.angles,
    estimatedCenterOfMass:p.center.toArray(),footContact:{method:clip.learned?'relative sole height candidate; flight unknown':'authored IK support',left:p.feet.L.contact,right:p.feet.R.contact},
    racketDirection:clip.learned?null:p.racketDir.toArray(),racketRollDegrees:clip.learned?null:p.roll,segmentLengths:model.lengths,
    reference:clip.learned?{model:'217-1 RBF ridge plus image-plane alignment',track:clip.id,pattern:clip.pattern,sourceCode:clip.code,camera:clip.camera,source:s.nearest.member,archive:s.nearest.archive,inputMethod:s.nearest.method,input2D:s.nearest.input,centerline2D:s.nearest.centerline,between:[s.a.index,s.b.index],fraction:s.u}:'Authored motion and leg IK. Segment proportions fitted from 217-1. Neutral arm directions from the 90 s reference.'};
}
$('#export').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(frameData(),null,2)],{type:'application/json'})),a=document.createElement('a');
  const suffix=clip.learned?'frame-'+sampleAt(clip,t).nearest.index+'-'+Math.round(t*1000):(t*clip.duration).toFixed(3)+'s';
  a.href=url;a.download=clip.id+'-'+suffix+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
catalog=createCatalog({
  show(c,member,title){
    select(c||{learned:true,empty:true,missing:true,frames:[],phases:[],preview:0,name:'원본 모션',duration:0},true);
    if(c&&!c.missing){
      $('#scene-name').textContent=title||c.name+' 장면';
      $('#scene-code').textContent=c.camera+'  /  '+c.code+'  /  '+c.source.split('_')[1];
    }
    const f=member&&c?.frames.find(f=>f.member===member);if(f)seek(f.at);
    draw();
  },
  getSelection(){return {clip,frame:clip.learned&&!clip.missing?sampleAt(clip,t).nearest:null};},
  pauseAtSource(){if(clip.learned&&!clip.missing){seek(sampleAt(clip,t).nearest.at);draw();}}
});
if(dataLanding){catalog.open();}else{catalog.activate(false);select(clip,true);draw();}
let prev=performance.now();
function animate(now){
  if(playing&&!document.hidden){
    t+=Math.max(0,now-prev)/1000*rate/clip.duration;
    if(t>=1){if(loop)t%=1;else{t=1;setPlaying(false);}}dirty=true;
  }
  prev=now;if(dirty)draw();stage?.render();requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange',()=>{prev=performance.now();});requestAnimationFrame(animate);

