import * as T from '../vendor/three.module.js';
import {createAthlete} from './athlete.js';
import {V,bones} from './rig.js';

const names={pelvis:'골반',chest:'흉곽',neck:'목',head:'머리',shoulder:'어깨',elbow:'팔꿈치',wrist:'손목',hand:'손',hip:'고관절',knee:'무릎',ankle:'발목',toe:'발끝',heel:'뒤꿈치'};
export function jointName(key){return names[key]||((key.endsWith('R')?'우':'좌')+' '+names[key.slice(0,-1)]);}
export const cameraNames={orbit:'자유',rear:'후면',front:'정면',side:'측면',source:'원본 근사'};
export function createStage(host,onCamera,thumbnail=false){
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(thumbnail?1:Math.min(window.devicePixelRatio,1.65));renderer.shadowMap.enabled=!thumbnail;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  host.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','오른손 배드민턴 선수의 3D 모션');
  const scene=new T.Scene();scene.background=new T.Color('#294044');scene.fog=new T.FogExp2('#294044',.092);
  const camera=new T.PerspectiveCamera(31,1,.035,65);
  const sky=new T.HemisphereLight('#f2faef','#9faaa0',1.58);scene.add(sky);
  const key=new T.DirectionalLight('#fff1dd',2.65);key.position.set(-3,7,-3);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-2.6,right:2.6,bottom:-2.6,top:2.6,near:.5,far:15});key.shadow.normalBias=.003;key.shadow.bias=-.00015;scene.add(key);
  const rim=new T.DirectionalLight('#cae4ec',1.45);rim.position.set(4,3,3);scene.add(rim);
  const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#314d4f',roughness:.98}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  function floorLines(points,color,opacity){
    const geo=new T.BufferGeometry().setFromPoints(points);
    scene.add(new T.LineSegments(geo,new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false})));
  }
  const grid=[];
  for(let i=-30;i<=30;i++){const x=i*.5;grid.push(V(x,.002,-15),V(x,.002,15),V(-15,.002,x),V(15,.002,x));}
  floorLines(grid,'#96b1af',.115);
  const marks=[];
  for(let i=-6;i<=6;i++)for(let j=-6;j<=6;j++){marks.push(V(i-.033,.004,j),V(i+.033,.004,j),V(i,.004,j-.033),V(i,.004,j+.033));}
  floorLines(marks,'#b2c2b9',.45);
  const stripeMaterial=new T.MeshBasicMaterial({color:'#a4b6aa',transparent:true,opacity:.31});
  function stripe(x,z,w,d){const p=new T.Mesh(new T.PlaneGeometry(w,d),stripeMaterial);p.rotation.x=-Math.PI/2;p.position.set(x,.001,z);scene.add(p);}
  for(const x of [-3.05,-2.59,2.59,3.05])stripe(x,0,.032,13.4);
  for(const z of [-6.7,-5.94,-1.98,1.98,5.94,6.7])stripe(0,z,6.1,.032);
  for(const z of [-4.34,4.34])stripe(0,z,.032,4.72);
  const athlete=createAthlete(scene);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=96;
  const shadowCtx=shadowCanvas.getContext('2d'),fade=shadowCtx.createRadialGradient(48,48,2,48,48,48);
  fade.addColorStop(0,'rgba(8,24,26,.69)');fade.addColorStop(.50,'rgba(8,24,26,.31)');fade.addColorStop(1,'rgba(8,24,26,0)');shadowCtx.fillStyle=fade;shadowCtx.fillRect(0,0,96,96);
  const shadowTexture=new T.CanvasTexture(shadowCanvas),contactShade={};
  for(const s of ['L','R']){
    const patch=new T.Mesh(new T.PlaneGeometry(.23,.40),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
    patch.rotation.order='YXZ';patch.rotation.x=-Math.PI/2;scene.add(patch);contactShade[s]=patch;
  }
  const dots=new T.Group();scene.add(dots);
  const overlayMaterial=color=>new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false});
  const geo=new T.SphereGeometry(.014,10,8),dotMeshes={},diagnostic=new T.Group();scene.add(diagnostic);
  const mats={R:overlayMaterial('#ffa776'),L:overlayMaterial('#70deed'),M:overlayMaterial('#fcf7df')};
  const jointKeys=[...new Set(bones.flat())];
  const svgNS='http://www.w3.org/2000/svg',leaders=document.createElementNS(svgNS,'svg');
  leaders.setAttribute('class','label-leaders');leaders.setAttribute('aria-hidden','true');host.append(leaders);
  const labels={},links={};for(const k of jointKeys){
    const dot=new T.Mesh(geo,mats[k.at(-1)]||mats.M);dot.renderOrder=5;dots.add(dot);dotMeshes[k]=dot;
    const span=document.createElement('span');span.textContent=jointName(k);span.className='joint-label '+(k.endsWith('L')?'left':'right');span.hidden=true;host.append(span);labels[k]=span;
    const line=document.createElementNS(svgNS,'line');leaders.append(line);links[k]=line;
  }
  const bonePos=new Float32Array(bones.length*6),boneGeo=new T.BufferGeometry();
  boneGeo.setAttribute('position',new T.BufferAttribute(bonePos,3));
  const skeleton=new T.LineSegments(boneGeo,new T.LineBasicMaterial({color:'#f6edcb',depthTest:false,depthWrite:false}));skeleton.frustumCulled=false;skeleton.renderOrder=4;scene.add(skeleton);
  const rings={};
  for(const s of ['L','R']){
    const ring=new T.Mesh(new T.RingGeometry(.103,.117,44),mats[s]);ring.rotation.x=-Math.PI/2;ring.renderOrder=2;diagnostic.add(ring);rings[s]=ring;
  }
  const centerDot=new T.Mesh(new T.OctahedronGeometry(.033),overlayMaterial('#e8f077'));centerDot.renderOrder=6;diagnostic.add(centerDot);
  const plumbGeo=new T.BufferGeometry().setFromPoints([V(),V()]);
  const plumb=new T.Line(plumbGeo,new T.LineDashedMaterial({color:'#e8f077',dashSize:.025,gapSize:.017,depthTest:false,depthWrite:false}));plumb.renderOrder=3;plumb.frustumCulled=false;diagnostic.add(plumb);
  const centerRing=new T.Mesh(new T.RingGeometry(.037,.048,24),centerDot.material);centerRing.rotation.x=-Math.PI/2;centerRing.renderOrder=3;diagnostic.add(centerRing);
  let angle=thumbnail?2.58:1.34,pitch=.16,distance=1,mode='orbit',target=V(0,.78,-.19),pose,toggles={},bounds=[],fitKey='',fit=3.6;
  let dirty=true;
  function resizeView(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
  resizeView();if(!thumbnail)new ResizeObserver(resizeView).observe(host);
  function view(m,comparison){mode=m;angle=m==='source'?comparison.angle:({orbit:1.34,rear:0,front:Math.PI,side:Math.PI*.5})[m];pitch=m==='source'?comparison.pitch:m==='orbit'?.16:.13;dirty=true;onCamera(m,Math.round(100/distance));}
  function zoom(scale){distance=T.MathUtils.clamp(distance*scale,.57,1.8);dirty=true;onCamera(mode,Math.round(100/distance));}
  function frameClip(samples){
    const box=new T.Box3();bounds=[];
    for(const p of samples){
      for(const j of Object.values(p.j))bounds.push(j.clone());
      bounds.push(p.j.head.clone().add(V(0,.14,0)));
      if(p.racketObserved!==false)bounds.push(p.j.handR.clone().addScaledVector(p.racketDir,.575));
    }
    box.setFromPoints(bounds).getCenter(target);bounds.forEach(v=>v.sub(target));fitKey='';
    dirty=true;
  }
  let drag=null;const canvas=renderer.domElement;
  canvas.tabIndex=0;canvas.title='드래그로 회전 · 휠로 확대/축소 · 방향키로 회전';
  canvas.onkeydown=e=>{
    const keys={ArrowLeft:[-.10,0],ArrowRight:[.10,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]},step=keys[e.key];
    if(!step)return;
    e.preventDefault();angle+=step[0];pitch=T.MathUtils.clamp(pitch+step[1],-.035,1.15);mode='orbit';dirty=true;onCamera(mode,Math.round(100/distance));
  };
  canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag[0],dy=e.clientY-drag[1];if(dx||dy){mode='orbit';onCamera(mode,Math.round(100/distance));angle-=dx*.009;pitch=T.MathUtils.clamp(pitch+dy*.007,-.035,1.15);dirty=true;}drag=[e.clientX,e.clientY];};
  canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001));},{passive:false});
  function update(p,opts){
    pose=p;toggles=opts;athlete.update(p);dots.visible=opts.points;skeleton.visible=opts.bones;
    for(const k of jointKeys)dotMeshes[k].position.copy(p.j[k]);
    bones.forEach(([a,b],i)=>{p.j[a].toArray(bonePos,i*6);p.j[b].toArray(bonePos,i*6+3);});boneGeo.attributes.position.needsUpdate=true;
    for(const s of ['L','R']){
      const foot=p.feet[s];rings[s].visible=opts.contact&&foot.contact;rings[s].position.copy(foot.sole);rings[s].position.y=.009;
      const shade=contactShade[s],middle=foot.toe.clone().lerp(foot.heel,.5);
      shade.position.set(middle.x,.005,middle.z);shade.rotation.y=-foot.yaw*Math.PI/180;
      shade.material.opacity=Math.exp(-8*middle.y)*.85;
    }
    for(const o of [centerDot,centerRing,plumb])o.visible=opts.center;
    centerDot.position.copy(p.center);centerRing.position.set(p.center.x,.012,p.center.z);
    const arr=plumbGeo.attributes.position;arr.setXYZ(0,p.center.x,.012,p.center.z);arr.setXYZ(1,p.center.x,p.center.y,p.center.z);arr.needsUpdate=true;plumb.computeLineDistances();dirty=true;
  }
  function render(){
    if(!dirty||!pose)return;dirty=false;
    // Fit the motion envelope once per clip, so there is no camera pumping during a stroke.
    const back=V(Math.sin(angle)*Math.cos(pitch),Math.sin(pitch),Math.cos(angle)*Math.cos(pitch));
    const right=V(Math.cos(angle),0,-Math.sin(angle)),up=back.clone().cross(right);
    const aperture=Math.tan(camera.fov*Math.PI/360);
    const key=[angle,pitch,camera.aspect].join(',');
    if(key!==fitKey){
      fit=2;fitKey=key;
      for(const v of bounds)fit=Math.max(fit,v.dot(back)+Math.max(Math.abs(v.dot(up))/aperture,Math.abs(v.dot(right))/(aperture*camera.aspect))*1.12);
    }
    const d=fit*distance;
    camera.position.set(target.x+d*Math.sin(angle)*Math.cos(pitch),target.y+d*Math.sin(pitch),target.z+d*Math.cos(angle)*Math.cos(pitch));
    camera.lookAt(target);camera.updateMatrixWorld();renderer.render(scene,camera);
    const w=host.clientWidth,h=host.clientHeight;
    leaders.style.display=toggles.names?'block':'none';
    for(const k of jointKeys)labels[k].hidden=!toggles.names;
    if(!toggles.names)return;
    const groups=[[],[]],points=jointKeys.map(k=>{
      const v=pose.j[k].clone().project(camera);return {k,x:(v.x+1)*w/2,y:(1-v.y)*h/2};
    });
    const chestX=points.find(p=>p.k==='chest').x;
    for(const p of points){
      const left=p.k==='head'||p.k==='pelvis'||(p.k!=='chest'&&p.k!=='neck'&&p.x<chestX);
      groups[left?0:1].push(p);
    }
    groups.forEach((items,side)=>{
      if(!items.length)return;
      items.sort((a,b)=>a.y-b.y);
      const column=T.MathUtils.clamp(side?Math.max(...items.map(p=>p.x))+18:Math.min(...items.map(p=>p.x))-70,4,w-62);
      let top=5;
      for(const p of items){p.row=Math.max(top,p.y-7);top=p.row+16;}
      let bottom=h-18;
      for(let i=items.length-1;i>=0;i--){items[i].row=Math.min(items[i].row,bottom);bottom=items[i].row-16;}
      for(const p of items){
        const label=labels[p.k],line=links[p.k];
        label.style.transform='translate('+column+'px,'+p.row+'px)';
        line.setAttribute('x1',p.x);line.setAttribute('y1',p.y);
        line.setAttribute('x2',column+(side?0:label.offsetWidth));line.setAttribute('y2',p.row+7);
      }
    });
  }
  return {view,zoom,frameClip,update,render,get camera(){return {mode,angle,pitch,distance};}};
}

