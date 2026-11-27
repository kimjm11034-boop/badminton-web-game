import * as T from 'three';
import {buildStands,arenaScoreboard} from './arena.js';
import {GLTFLoader} from '/vendor/jsm/loaders/GLTFLoader.js';
import {clone} from '/vendor/jsm/utils/SkeletonUtils.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const mat=(color,roughness=.78)=>new T.MeshStandardMaterial({color,roughness});
const world=p=>V(p.x,p.z,-p.y);
function box(parent,w,h,d,position,material){
 const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.copy(position);m.receiveShadow=true;parent.add(m);return m;
}
function pole(parent,start,end,r,m){
 const dir=end.clone().sub(start),o=new T.Mesh(new T.CylinderGeometry(r,r,dir.length(),10),m);
 o.position.copy(start).lerp(end,.5);o.quaternion.setFromUnitVectors(V(0,1,0),dir.normalize());parent.add(o);return o;
}
function banner(parent,words,w,h,x,y,z,bg,fg){
 const c=document.createElement('canvas');c.width=1600;c.height=230;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,c.width,c.height);
 g.fillStyle=fg;g.font='italic 800 132px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(words,800,125,1520);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
 const plane=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex}));plane.position.set(x,y,z);parent.add(plane);
}
const clipFor={clear:'high-clear',drive:'drive',drop:'drop',smash:'smash',net:'hairpin',crossNet:'hairpin',slice:'cut',block:'defence',lift:'under',short:'short-serve',long:'high-serve'};
export async function createCourt(canvas,settings){
 const gl=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});gl.setPixelRatio(Math.min(devicePixelRatio,1.5));gl.shadowMap.enabled=true;gl.shadowMap.type=T.PCFSoftShadowMap;
 gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1.22;const scene=new T.Scene();scene.background=new T.Color('#111b26');scene.fog=new T.FogExp2('#101c2b',.019);
 const cam=new T.PerspectiveCamera(settings.fov,1,.035,60);cam.rotation.order='YXZ';scene.add(cam);
 scene.add(new T.HemisphereLight('#fff0cd','#759c95',1.8));const sun=new T.DirectionalLight('#fff3de',2.6);sun.position.set(-4,9,3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-10,right:10,top:12,bottom:-12});sun.shadow.normalBias=.016;scene.add(sun);
 const fill=new T.DirectionalLight('#bfe6ff',1.3);fill.position.set(5,5,-5);scene.add(fill);
 const floor=mat('#117c52'),line=mat('#f4f3d6'),hall=mat('#921c2b'),blue=mat('#1a514e');
 const weave=document.createElement('canvas');weave.width=weave.height=128;
 const brush=weave.getContext('2d'),pix=brush.createImageData(128,128);let seed=73;
 for(let i=0;i<128*128;i++){seed=(1664525*seed+1013904223)>>>0;const v=215+(seed>>>28)+(i%4===0?7:0);pix.data.set([v,v,v,255],i*4);}
 brush.putImageData(pix,0,0);const grain=new T.CanvasTexture(weave);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(12,25);grain.colorSpace=T.SRGBColorSpace;floor.map=grain;
 box(scene,48,.16,52,V(0,-.125,0),hall);
 const court=new T.Group();scene.add(court);
 box(court,7.5,.025,15.5,V(0,-.028,0),floor);box(court,6.1,.019,13.4,V(0,-.010,0),floor);
 for(const x of [-3.05,-2.59,2.59,3.05])box(court,.04,.004,13.4,V(x,.002,0),line);
 for(const z of [-6.7,-5.94,-1.98,1.98,5.94,6.7])box(court,6.1,.004,.04,V(0,.002,z),line);
 for(const z of [-4.34,4.34])box(court,.04,.004,4.72,V(0,.002,z),line);
 for(const x of [-3.05,3.05]){pole(court,V(x,0,0),V(x,1.55,0),.034,mat('#db9d52'));box(court,.26,.12,.33,V(x,.06,0),blue);}
 const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');ctx.strokeStyle='#344541';ctx.lineWidth=1.8;ctx.strokeRect(0,0,32,32);
 const netTex=new T.CanvasTexture(c);netTex.wrapS=netTex.wrapT=T.RepeatWrapping;netTex.repeat.set(280,34);
 const net=new T.Mesh(new T.PlaneGeometry(6.1,.76),new T.MeshBasicMaterial({map:netTex,transparent:true,side:T.DoubleSide,depthWrite:false,opacity:.43}));net.position.y=1.14;court.add(net);
 pole(court,V(-3.05,1.55,0),V(0,1.524,0),.014,line);pole(court,V(0,1.524,0),V(3.05,1.55,0),.014,line);
 buildStands(scene);const scoreboard=arenaScoreboard(scene);
 for(let i=-2;i<=2;i++){
  box(scene,3.35,.68,.12,V(i*3.48,.34,-9.8),mat('#293648'));
  banner(scene,i===0?'Minton Web Game':i%2?'DOUBLES    /    01':'MINTON',3.26,.42,i*3.48,.35,-9.73,'#1c2d3d','#d2dddb');
 }
 const shadow=new T.Mesh(new T.CircleGeometry(.075,20),new T.MeshBasicMaterial({color:'#18382e',transparent:true,opacity:.55,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
 const loader=new GLTFLoader();
 const [glb,racketAsset,shuttleAsset]=await Promise.all([
  loader.loadAsync('/doubles/assets/player.glb'),
  loader.loadAsync('/doubles/assets/racket.glb'),
  loader.loadAsync('/doubles/assets/shuttle.glb'),
 ]);
 const shuttle=shuttleAsset.scene;scene.add(shuttle);
 const own=racketAsset.scene.getObjectByName('FirstPersonRacket');
 const stringBedHeight=own.userData.stringBedHeight;
 cam.add(own);
 const clips=new Map(glb.animations.map(c=>[c.name,c])),actors=[];
 for(let i=1;i<=3;i++){
  const group=new T.Group(),model=clone(glb.scene);group.add(model);scene.add(group);
  model.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;o.castShadow=true;const m=o.material;
   if(i>1 && m.name?.includes('jersey')){
    const team=m.clone();
    team.onBeforeCompile=shader=>{
     shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
       float cloth = smoothstep(0.012, 0.20, dot(diffuseColor.rgb, vec3(0.21, 0.72, 0.07)));
       diffuseColor.rgb = mix(vec3(0.19, 0.029, 0.018), vec3(0.83, 0.27, 0.115), cloth);`);
    };
    o.material=team;
   }
  });
  const mixer=new T.AnimationMixer(model),root=model.getObjectByName('root');
  actors.push({group,model,mixer,root,active:null,tag:null,swung:-20});
 }
 let yaw=0,lookPitch=0,previousTime=0;const point=V(),aim=V(),grip=V(),dir=V();
 function render(s,held){
  const p=s.players[0],b=s.ball,dt=Math.min(.08,Math.max(0,s.time-previousTime));previousTime=s.time;
  scoreboard(s.score);court.scale.set(settings.width/6.10,1,settings.length/13.40);
  const walking=Math.min(1,Math.hypot(p.vx,p.vy)/4.65)*(p.jump>0?0:1);
  cam.fov=settings.fov;cam.updateProjectionMatrix();cam.position.set(p.x,settings.eye+p.jump+.014*walking*Math.sin(s.time*15),-p.y);
  const restPitch=Math.atan2(1.524-settings.eye,Math.max(1.1,-p.y))+T.MathUtils.degToRad(settings.pitch);
  cam.rotation.set(T.MathUtils.clamp(restPitch+lookPitch,-1.48,1.52),yaw,0,'YXZ');
  own.visible=s.phase!=='over';
  if(s.phase==='over'){cam.position.set(3.8,4.4,settings.length*.72);cam.lookAt(0,.55,-.6);}
  cam.updateMatrixWorld();
  for(const [i,actor] of actors.entries()){
   const q=s.players[i+1];actor.group.position.set(q.x,0,-q.y);actor.group.rotation.y=i===0?Math.PI:0;
   const age=s.time-q.swing;let tag=age<.53?(clipFor[q.shot]||'drive'):Math.hypot(q.vx,q.vy)>.6?'shuffle':'ready';
   if(age<.53&&q.hand==='back'&&clips.has('back-'+tag))tag='back-'+tag;
   if(actor.tag!==tag||age<.53&&actor.swung!==q.swing){
    const next=actor.mixer.clipAction(clips.get(tag));if(actor.active&&actor.active!==next)actor.active.fadeOut(.09);
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();if(actor.tag!==null)next.fadeIn(.08);
    if(age<.53){next.time=next.getClip().duration*.50;actor.swung=q.swing;}actor.active=next;actor.tag=tag;
   }
   actor.mixer.update(dt);actor.model.position.set(-actor.root.position.x,0,-actor.root.position.z);
  }
  shuttle.visible=shadow.visible=!!b;
  if(b){shuttle.position.copy(world(b));const distance=shuttle.position.distanceTo(cam.position);
   const metresPerPixel=2*distance*Math.tan(T.MathUtils.degToRad(cam.fov/2))/Math.max(1,canvas.clientHeight);
   const visibilityScale=T.MathUtils.clamp(12*metresPerPixel/.065,1,4);
   shuttle.scale.setScalar(settings.bird*visibilityScale);const v=V(-b.vx,-b.vz,b.vy);if(v.lengthSq()>.01)shuttle.quaternion.setFromUnitVectors(V(0,1,0),v.normalize());
   shadow.position.set(b.x,.012,-b.y);}
  const elapsed=s.time-p.strikeAt,hand=held?.hand||p.hand,sign=hand==='back'?-1:1;
  const back=hand==='back',arc=back?settings.backArc:settings.arc,overhead=['clear','smash','drop','slice'].includes(p.shot);
  const low=['lift','block','net','crossNet','short','long'].includes(p.shot),cut=p.shot==='slice'||p.shot==='block';
  let roll=sign*.15;
  // Camera-local grip path. The string-bed centre passes through the world contact
  // at release, then the forehand crosses left and the backhand opens right.
  grip.set(.24,-.35,-.56);dir.set(.40,.90,-.21).normalize();
  if(held){const pull=Math.min(1,.22+held.distance/100);grip.x+=(back?-.43:.18)*pull*arc;grip.y+=(back?.035:.10)*pull;dir.set(sign*(.50+.48*pull),back?.55:.77,-.14).normalize();roll=sign*(.25+pull*.6);}
  else if(elapsed<0&&elapsed>=-.07){
   const u=T.MathUtils.smootherstep(1+elapsed/.065,0,1);
   const target=p.hit?cam.worldToLocal(world(p.hit)):V(sign*.26,overhead?.34:-.09,-.81);
   dir.set(sign*(.91-.49*u),.79,-.33).normalize();
   grip.set(.24+(back?-.43:.18)*arc,low?-.39:-.25,-.56).lerp(target.addScaledVector(dir,-stringBedHeight),u);roll=sign*(.85-.65*u);
  }else if(elapsed>=0&&elapsed<.42){
   const u=elapsed/.42,decay=(1-u)*(1-u),sweep=Math.sin(Math.PI*u)*arc;
   const impact=p.hit?cam.worldToLocal(world(p.hit)):V(sign*.26,overhead?.34:-.09,-.81);
   aim.set(sign*.24,overhead?.32:-.05,-.94);
   const rise=p.shot==='smash'?-.53:p.shot==='clear'?-.17:overhead?-.28:p.shot==='lift'?.49:low?.18:.08;
   point.copy(impact).lerp(aim,Math.min(1,u*3)).add(V((back?.52:-.72)*sweep+(p.aim||0)*.22*sweep,rise*sweep+(cut?.10*Math.sin(2*Math.PI*u):0),.10*sweep));
   dir.set(sign*(.42-(back?1.14:1.42)*sweep),.79-(overhead?.72:.10)*sweep,-.33).normalize();
   grip.lerp(point.addScaledVector(dir,-stringBedHeight),decay);
   roll=sign*(.15+(back?-.68:1.06)*sweep)+(cut?.50*sweep*(p.cutSign||1):0);
  }
  own.position.copy(grip);own.quaternion.setFromUnitVectors(V(0,1,0),dir);own.rotateY(roll);
  gl.render(scene,cam);
 }
 new ResizeObserver(()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h){gl.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}}).observe(canvas);
 return {
  render,actorCount:actors.length,
  get yaw(){return yaw;},get pitch(){return lookPitch;},
  look(dx,dy){const rate=.0022*settings.sensitivity;yaw=T.MathUtils.euclideanModulo(yaw-dx*rate+Math.PI,Math.PI*2)-Math.PI;lookPitch=T.MathUtils.clamp(lookPitch-dy*rate,-1.44,1.54);},
  resetView(){yaw=lookPitch=0;},
  faceShuttle(p){const v=world(p).sub(cam.position);yaw=Math.atan2(-v.x,-v.z);lookPitch+=Math.atan2(v.y,Math.hypot(v.x,v.z))-cam.rotation.x;lookPitch=T.MathUtils.clamp(lookPitch,-1.44,1.54);},
  project(p){point.copy(world(p));const local=cam.worldToLocal(point.clone());point.project(cam);return {x:point.x,y:point.y,visible:local.z<0&&point.z<=1,ax:local.x,ay:local.y,behind:local.z>=0};}
 };
}
