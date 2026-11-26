import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const $=s=>document.querySelector(s),stage=$('#stage');
async function start(){
 const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;stage.append(renderer.domElement);
 scene.background=new T.Color('#d3e1dc');scene.fog=new T.FogExp2('#c4d6cf',.048);
 const camera=new T.PerspectiveCamera(32,1,.03,90),controls=new OrbitControls(camera,renderer.domElement);
 controls.target.set(0,1.34,.02);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2.15;controls.maxDistance=9;controls.maxPolarAngle=1.52;
 let baseline=5.22,centerHeight=1.34;
 function cameraAt(v){
  const angles={hero:.54,rear:Math.PI,side:Math.PI/2,front:0},a=angles[v];camera.position.copy(controls.target).add(new T.Vector3(Math.sin(a)*baseline,.32,Math.cos(a)*baseline));controls.update();
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));
 }
 cameraAt('hero');for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>cameraAt(b.dataset.view);
 controls.addEventListener('start',()=>document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false')));
 scene.add(new T.HemisphereLight('#fff8e9','#a2b7aa',1.35));
 function light(col,p,power,shadow=false){const l=new T.DirectionalLight(col,power);l.position.set(...p);scene.add(l);if(shadow){l.castShadow=true;l.shadow.mapSize.set(2048,2048);Object.assign(l.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:15});l.shadow.normalBias=.012;l.shadow.bias=-.00025;l.shadow.radius=3;}}
 light('#fff4d9',[3,6,4],2.65,true);light('#cedeff',[-3,3,-4],2.05);light('#ffedda',[-4,2,3],.50);
 const mat=(color,roughness=.86)=>new T.MeshStandardMaterial({color,roughness});
 function box(x,y,z,w,h,d,m){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.receiveShadow=true;scene.add(o);return o;}
 const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=128;
 const gr=grainCanvas.getContext('2d'),pixels=gr.createImageData(128,128);
 let seed=211;for(let i=0;i<pixels.data.length;i+=4){seed=(1664525*seed+1013904223)>>>0;const n=231+(seed>>>28);pixels.data.set([n,n,n,255],i);}gr.putImageData(pixels,0,0);
 const grain=new T.CanvasTexture(grainCanvas);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(38,66);grain.colorSpace=T.SRGBColorSpace;
 const court=mat('#39746b');court.map=grain;box(0,-.046,3.2,9,.08,17,court);box(0,-.094,0,90,.08,90,mat('#adbeb3'));
 const stripe=mat('#daead3');
 for(const x of [-3.05,-2.59,2.59,3.05])box(x,-.004,3.2,.036,.005,13.40,stripe);
 for(const z of [-6.7,-5.94,-1.98,1.98,5.94,6.7])box(0,-.003,z+3.2,6.10,.005,.035,stripe);
 for(const z of [-4.34,4.34])box(0,-.003,z+3.2,.034,.005,4.72,stripe);
 const netTex=document.createElement('canvas');netTex.width=netTex.height=32;const nt=netTex.getContext('2d');nt.fillStyle='#193b38';nt.fillRect(0,0,1.8,32);nt.fillRect(0,0,32,1.8);
 const netMap=new T.CanvasTexture(netTex);netMap.wrapS=netMap.wrapT=T.RepeatWrapping;netMap.repeat.set(280,34);
 const netMat=new T.MeshBasicMaterial({map:netMap,side:T.DoubleSide,transparent:true,opacity:.7,depthWrite:false});
 const net=new T.Mesh(new T.PlaneGeometry(6.1,.76),netMat);net.position.set(0,1.14,3.2);scene.add(net);
 const netTop=box(0,1.524,3.2,6.12,.024,.012,mat('#e9ecdc')),posts=[];
 for(const x of [-3.07,3.07])posts.push(box(x,.775,3.2,.045,1.55,.045,mat('#425857')));
 // Diffuse daylight through clerestory panels; the main court remains clear in every inspection view.
 const pillar=mat('#b1c0b7'),wall=mat('#c4d0c6'),glass=new T.MeshBasicMaterial({color:'#eef4e7'});
 for(const z of [-12,12]){
  box(0,2.6,z,31,5.2,.20,wall);box(0,2.8,z-Math.sign(z)*.13,29,2.3,.03,glass);
  for(let x=-14;x<15;x+=2.45)box(x,2.6,z-Math.sign(z)*.17,.09,5.2,.15,pillar);
 }
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d');
 const grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(4,20,20,.42)');grad.addColorStop(.50,'rgba(9,30,27,.15)');grad.addColorStop(1,'rgba(14,30,29,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
 const tex=new T.CanvasTexture(shadowCanvas),contact=[];
 for(const s of ['L','R']){
  const patch=new T.Mesh(new T.PlaneGeometry(.34,.55),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));patch.rotation.x=-Math.PI/2;scene.add(patch);contact.push(patch);
 }
 new ResizeObserver(()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(stage);
 const [glb,items,references]=await Promise.all([new GLTFLoader().loadAsync('./athlete.glb'),fetch('./catalog.json').then(r=>r.json()),fetch('./reference-frames.json').then(r=>r.json())]);
 scene.add(glb.scene);glb.scene.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=false;m.frustumCulled=false;}});
 const feet=['L','R'].map(s=>glb.scene.getObjectByName('foot'+s)),rootBone=glb.scene.getObjectByName('root'),mix=new T.AnimationMixer(glb.scene);
 const actions=Object.fromEntries(glb.animations.map(c=>[c.name,mix.clipAction(c)]));
 let item,action,previous,blendEnd=0,playing=true,loop=true,rate=.5,activeGroup='전체';
 const turnAxes=new T.Group();scene.add(turnAxes);turnAxes.visible=false;
 const forward=new T.Vector3(0,0,1),up=new T.Vector3(0,1,0),orientation=new T.Quaternion(),direction=new T.Vector3(),degrees=T.MathUtils.radToDeg;
 function bodyAxis(bone,color,height,width){
  const group=new T.Group();turnAxes.add(group);
  const arrow=new T.ArrowHelper(forward,new T.Vector3(),width,color,.055,.034);
  const bar=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-width,0,0),new T.Vector3(width,0,0)]),new T.LineBasicMaterial({color}));
  group.add(arrow,bar);group.traverse(o=>{if(o.material){o.material.depthTest=false;o.material.depthWrite=false;o.renderOrder=20;}});
  return ()=>{bone.getWorldPosition(group.position);group.position.y+=height;bone.getWorldQuaternion(orientation);direction.copy(forward).applyQuaternion(orientation);
   const heading=Math.atan2(direction.x,direction.z);group.quaternion.setFromAxisAngle(up,heading);return degrees(heading);};
 }
 const hipAxis=bodyAxis(rootBone,0xffad43,.01,.28),chestAxis=bodyAxis(glb.scene.getObjectByName('spine01'),0x46e4fb,.04,.33);
 const turnButton=$('#show-turn'),turnValues=$('#turn-values');
 const hipValue=document.createElement('span'),chestValue=document.createElement('span'),relativeValue=document.createElement('span');
 hipValue.className='hip-value';chestValue.className='chest-value';turnValues.append(hipValue,'  ·  ',chestValue,'  ·  ',relativeValue);
 turnButton.onclick=()=>{turnAxes.visible=!turnAxes.visible;turnButton.setAttribute('aria-pressed',String(turnAxes.visible));turnValues.hidden=!turnAxes.visible;};
 const inset=document.createElement('figure'),image=new Image(),caption=document.createElement('figcaption');inset.className='observed';inset.hidden=true;inset.append(image,caption);stage.append(inset);
 const captions={match:'실제 경기 영상 · 3D 추정',blended:'경기 동작 블렌딩',sequence:'경기 사진 연속 복원',sensor:'전신 센서 캡처',photo:'원본 사진 참조 · 동작 합성',authored:'동작 설계 · IK'};
 function toggle(b){playing=b;$('#play').textContent=b?'Ⅱ':'▶';$('#play').setAttribute('aria-label',b?'일시정지':'재생');}
 function drawTime(){
  if(!item)return;const t=action.time/item.duration;$('#time').value=Math.round(t*1000);$('#clock').textContent=action.time.toFixed(2)+' / '+item.duration.toFixed(2)+' s';
  const frames=references[item.id];inset.hidden=!frames;
  if(frames){const close=frames.reduce((a,b)=>Math.abs(a.at-t)<Math.abs(b.at-t)?a:b);if(image.dataset.member!==close.member){image.src=close.image;image.dataset.member=close.member;image.alt=close.member;}caption.textContent='원본 #'+close.index+(Math.abs(close.at-t)<.01?' · 관찰 시점':' · 가까운 관찰 시점');}
  $('#phase').textContent=item.contact==null?'동작 재생':t<item.contact-.13?'준비 · 진입':t<item.contact-.025?'가속':t<item.contact+.04?'타격 추정 구간':t<.81?'팔로스루':'회복';
 }
 function activate(it,initial=false){
  const blend=!initial&&playing&&action!==actions[it.id];if(previous){previous.stop();previous=null;}
  if(action&&action!==actions[it.id]){if(blend)previous=action;else action.stop();}
  item=it;action=actions[it.id];action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).setLoop(loop?T.LoopRepeat:T.LoopOnce,Infinity);action.clampWhenFinished=!loop;action.play();
  const [lo,hi]=it.bounds;centerHeight=(lo+hi)*.5;const fit=Math.max(3.6,(hi-lo+.31)*.54/Math.tan(T.MathUtils.degToRad(camera.fov*.5)));
  camera.position.sub(controls.target).multiplyScalar(fit/baseline).add(controls.target);baseline=fit;
  action.time=playing?0:item.duration*(it.contact??.45);if(blend){action.crossFadeFrom(previous,.18,false);blendEnd=mix.time+.18;}mix.update(0);
  $('#name').textContent=it.name;$('#english').textContent=it.en;$('#category').textContent=it.family+'  /  '+captions[it.source];
  $('#peak').textContent=it.contact!=null?'타격 추정 구간':'대표 자세';const detail=$('#details');detail.replaceChildren();
  $('#before').textContent=it.contact!=null?'타격 전':'동작 초반';$('#after').textContent=it.contact!=null?'타격 후':'동작 후반';
  const ref=it.reference;
  let msg='발 디딤과 체중 이동, 라켓 궤적을 설계했습니다.';
  if(it.source==='sensor')msg=ref.description+' · 같은 센서 기록 대비 12관절 평균 3D 차이 '+it.evaluation.meanCm.toFixed(2)+' cm. 수평 72시점에서 투영 오차 3 cm 이내 '+(it.evaluation.projectedWithin3cm*100).toFixed(1)+'%. 라켓은 손 센서 기준 추정입니다.';
  else if(it.source==='match')msg=ref.description+' · '+ref.set+'세트 '+ref.rally+'번째 랠리 '+ref.stroke+'번째 타구. 영상 '+ref.frames+'프레임에서 추정한 선수 관절과 코트 이동을 재생합니다.';
  else if(it.source==='sequence')msg=ref.description+'을 연결했습니다. 원본 사이의 자세·깊이·재생 시간은 추정입니다.';
  else if(ref){msg=ref.member?'자료 '+ref.code+' · '+ref.camera+' · '+ref.member+'에서 추정한 오른팔 방향을 타격 구간에 반영했습니다. ':'';if(ref.donor)msg+=(items.find(v=>v.id===ref.donor)?.name||ref.donor)+'의 상체 궤적을 블렌딩했습니다.';}
  detail.append(msg);if(it.source==='match'){const a=document.createElement('a');a.href=ref.url;a.target='_blank';a.rel='noopener';a.textContent=' 경기 원본 영상 ↗';detail.append(a);}
  Array.from($('#list').children).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===it.id)));drawTime();
 }
 function listing(){
  $('#list').replaceChildren();const chosen=items.filter(i=>activeGroup==='전체'||(activeGroup==='경기 영상'?i.source==='match':activeGroup==='센서'?i.source==='sensor':activeGroup==='연속 사진'?i.source==='sequence':i.family===activeGroup));$('#count').textContent=chosen.length;
  for(const it of chosen){const b=document.createElement('button');b.dataset.id=it.id;b.setAttribute('aria-pressed',String(it===item));const code=document.createElement('span');code.className='seq';code.textContent=String(items.indexOf(it)+1).padStart(2,'0');
   const title=document.createElement('span'),strong=document.createElement('b'),small=document.createElement('small'),dur=document.createElement('time');strong.textContent=it.name;small.textContent=it.en;title.append(strong,small);dur.textContent=it.duration.toFixed(2)+' s';b.append(code,title,dur);b.onclick=()=>activate(it);$('#list').append(b);}
 }
 for(const cat of ['전체','경기 영상','센서','연속 사진','전위','중위','후위','서브','풋워크']){const b=document.createElement('button');b.textContent=cat;b.setAttribute('aria-pressed',String(cat==='전체'));b.onclick=()=>{activeGroup=cat;[...$('#filters').children].forEach(v=>v.setAttribute('aria-pressed',String(v===b)));listing();};$('#filters').append(b);}
 $('#play').onclick=()=>{if(!playing&&action.time>=item.duration-.001){action.reset().play();}toggle(!playing);};
 function seek(t){if(previous){previous.stop();previous=null;action.stopFading().setEffectiveWeight(1);}toggle(false);action.paused=false;action.enabled=true;action.time=Math.min(item.duration-.00001,Math.max(0,t*item.duration));mix.update(0);drawTime();}
 $('#time').oninput=e=>seek(e.target.value/1000);$('#peak').onclick=()=>seek(item.contact??.48);
 $('#before').onclick=()=>seek(item.contact==null?.22:Math.max(0,item.contact-.18));$('#after').onclick=()=>seek(item.contact==null?.78:Math.min(1,item.contact+.10));
 $('#speed').onchange=e=>rate=Number(e.target.value);$('#loop').onclick=()=>{loop=!loop;$('#loop').setAttribute('aria-pressed',String(loop));action.setLoop(loop?T.LoopRepeat:T.LoopOnce,Infinity);action.clampWhenFinished=!loop;};
 mix.addEventListener('finished',()=>{if(!loop)toggle(false);});listing();activate(items.find(i=>i.id==='smash'),true);cameraAt('rear');toggle(true);
 $('#loading').hidden=true;stage.dataset.ready='true';let last=performance.now();
 function render(now){const dt=Math.min((now-last)/1000,.08);last=now;if(playing){mix.update(dt*rate);if(previous&&mix.time>=blendEnd){previous.stop();previous=null;}drawTime();}
  glb.scene.updateMatrixWorld();for(let i=0;i<2;i++){if(!feet[i])continue;const p=feet[i].getWorldPosition(new T.Vector3());contact[i].position.set(p.x,.001,p.z+.05);contact[i].material.opacity=Math.max(0,1-(p.y-.077)*4);}
  if(turnAxes.visible){const h=hipAxis(),c=chestAxis(),delta=T.MathUtils.euclideanModulo(c-h+180,360)-180;
   hipValue.textContent='골반 '+h.toFixed(0)+'°';chestValue.textContent='흉곽 '+c.toFixed(0)+'°';relativeValue.textContent='상대 회전 '+delta.toFixed(0)+'°';}
  const target=rootBone.getWorldPosition(new T.Vector3());target.y=centerHeight;
  camera.position.add(target.clone().sub(controls.target));controls.target.copy(target);
  controls.update();net.visible=netTop.visible=camera.position.z<3.05;renderer.render(scene,camera);requestAnimationFrame(render);
 }requestAnimationFrame(render);
}
start().catch(e=>{$('#loading').textContent='선수 모델을 열 수 없습니다. '+e.message;console.error(e);});
