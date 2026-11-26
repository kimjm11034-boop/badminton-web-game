import * as T from './vendor/three.module.js';
import {buildPose} from './motion.js';
import {createAthlete} from './motion-lab/athlete.js';
const V=p=>new T.Vector3(p[0],p[2],-p[1]);
export function createArena3D(host){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 renderer.domElement.className='webgl-court';host.prepend(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#101721');scene.fog=new T.Fog('#101721',30,65);
 const camera=new T.PerspectiveCamera(22,1,.1,100);const look=new T.Vector3(0,.7,0);camera.position.set(4.1,7.4,22);
 scene.add(new T.HemisphereLight('#edf6ff','#263b40',2));
 const light=new T.DirectionalLight('#fff4dc',3.2);light.position.set(-5,14,4);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:1,far:40});light.shadow.bias=-.0005;scene.add(light);
 const rim=new T.DirectionalLight('#b9d8ff',1.4);rim.position.set(7,7,-12);scene.add(rim);
 const mat=(color,roughness=.75,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const green=mat('#21865e'),blue=mat('#1a3a85'),white=mat('#f4f3e8'),red=mat('#ae3836'),steel=mat('#9ba7b3',.35,.6),dark=mat('#152434');
 function mesh(geo,material,pos=[0,0,0],scale){const m=new T.Mesh(geo,material);m.position.copy(V(pos));if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
 const box=(w,h,d,m,p)=>mesh(new T.BoxGeometry(w,h,d),m,p);
 function rod(a,b,r,material){const m=mesh(new T.CylinderGeometry(r,r,1,8),material);const av=V(a),bv=V(b);m.position.copy(av).add(bv).multiplyScalar(.5);m.scale.y=av.distanceTo(bv);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return m;}
 box(28,.12,34,blue,[0,0,-.12]);box(7.2,.025,15.4,mat('#1a674b'),[0,0,-.025]);box(6.1,.012,13.4,green,[0,0,-.005]);
 const stripe=(x,y,w,d)=>box(w,.008,d,white,[x,y,.008]);
 for(const x of [-3.05,-2.59,2.59,3.05])stripe(x,0,.04,13.4);
 for(const y of [-6.7,-5.94,-1.98,1.98,5.94,6.7])stripe(0,y,6.1,.04);
 for(const s of [-1,1])stripe(0,s*4.34,.04,4.72);
 for(const s of [-1,1]){box(.16,.7,18,red,[s*5.4,0,.35]);box(.2,.04,18,mat('#e26b62'),[s*5.4,0,.72]);}
 box(11,.85,.15,red,[0,9.2,.425]);
 // 실험용 빈 경기장: 관중과 관중석 메시 제거.
 for(const x of [-3.05,3.05]){rod([x,0,0],[x,0,1.57],.035,steel);box(.32,.15,.4,mat('#17436b'),[x,0,.075]);}
 const netCanvas=document.createElement('canvas');netCanvas.width=256;netCanvas.height=128;const nc=netCanvas.getContext('2d');nc.clearRect(0,0,256,128);nc.strokeStyle='#ccd4ce';nc.lineWidth=1;nc.globalAlpha=.65;for(let x=0;x<256;x+=8){nc.beginPath();nc.moveTo(x,0);nc.lineTo(x,128);nc.stroke();}for(let y=0;y<128;y+=8){nc.beginPath();nc.moveTo(0,y);nc.lineTo(256,y);nc.stroke();}
 const net=mesh(new T.PlaneGeometry(6.1,.76),new T.MeshStandardMaterial({map:new T.CanvasTexture(netCanvas),transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false}),[0,0,1.15]);net.castShadow=false;
 rod([-3.05,0,1.55],[0,0,1.524],.022,white);rod([0,0,1.524],[3.05,0,1.55],.022,white);
 // 높은 주심석 하나만 배치합니다.
 const cx=-4.15;box(.72,1.5,.7,red,[cx,0,.75]);box(.7,.12,.7,dark,[cx,0,1.57]);for(const y of [-.4,.4])rod([cx-.36,y,0],[cx-.36,y,2.08],.025,steel);for(let z=.2;z<1.5;z+=.25)rod([cx-.36,-.4,z],[cx+.36,-.4,z],.018,steel);
 box(.38,.5,.28,mat('#17324d'),[cx,0,1.9]);mesh(new T.SphereGeometry(.13,12,10),mat('#c8aa90'),[cx,0,2.28]);rod([cx,0,1.7],[cx+.3,0,1.58],.08,dark);rod([cx+.3,0,1.58],[cx+.3,0,1.05],.065,dark);box(.4,.045,.4,dark,[cx+.35,0,2.0]);
 const athletes=[createAthlete(scene),createAthlete(scene,true)];
 const bird=new T.Group();scene.add(bird);const cork=new T.Mesh(new T.SphereGeometry(.035,12,8),mat('#fff4d3'));cork.scale.y=1.2;bird.add(cork);
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const feather=new T.Mesh(new T.ConeGeometry(.018,.16,4),white);feather.position.set(Math.cos(a)*.047,.105,Math.sin(a)*.047);feather.rotation.z=-Math.cos(a)*.28;feather.rotation.x=Math.sin(a)*.28;bird.add(feather);}
 const pathGeo=new T.BufferGeometry(),pathLine=new T.Line(pathGeo,new T.LineBasicMaterial({color:'#dcffae',transparent:true,opacity:.85}));scene.add(pathLine);
 const shadow=mesh(new T.CircleGeometry(.13,24),new T.MeshBasicMaterial({color:'#062c20',transparent:true,opacity:.42,depthWrite:false}));shadow.rotation.x=-Math.PI/2;
 let width=1,height=1;
 return {renderer,resize(w,h){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();},
  project(x,y,z){const p=V([x,y,z]).project(camera);return{x:(p.x*.5+.5)*width,y:(-.5*p.y+.5)*height,s:65};},
  render(state){
   const {players,time,ball,trail,charge=0,jump=0,view=0}=state;
   const high=ball?Math.max(0,ball.z-4):0,wide=Math.max(1,1.4/camera.aspect);
   const desired=new T.Vector3(view?7:4.1,(view?9:7.4)+high*.25,22*wide+high*.75);camera.position.lerp(desired,.065);camera.lookAt(look);
   players.forEach((p,index)=>athletes[index].update(buildPose(p,time,{charge:index?0:charge,jump:index?0:jump}).rig));
   bird.visible=shadow.visible=!!ball;
   if(ball){bird.position.copy(V([ball.x,ball.y,ball.z]));const velocity=V([ball.vx,ball.vy,ball.vz]);if(velocity.length()>.05)bird.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),velocity.normalize().negate());shadow.position.copy(V([ball.x,ball.y,.02]));shadow.scale.setScalar(1+ball.z*.08);}
   const coords=[];for(const p of trail){const v=V([p.x,p.y,p.z]);coords.push(v.x,v.y,v.z);}pathGeo.setAttribute('position',new T.Float32BufferAttribute(coords,3));pathGeo.computeBoundingSphere();pathLine.visible=coords.length>3;
   renderer.render(scene,camera);
  }
 };
}
