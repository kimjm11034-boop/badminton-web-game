import * as T from '../vendor/three.module.js';
import {V} from './rig.js';

const mat=(color,roughness=.78,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const skin=mat('#b97d5f'), hair=mat('#241d1c'), shorts=mat('#172837'), peach=mat('#e8734a'),
  white=mat('#e9e7d6'), rubber=mat('#ccd1c4'), ink=mat('#1a2b35'), teal=mat('#477c79'), lip=mat('#925e50');
const sphere=new T.SphereGeometry(1,24,16);
const rodGeometry=new T.CylinderGeometry(1,1,1,12);
const yAxis=V(0,1,0);
function mesh(parent,geo,material) {
  const m=new T.Mesh(geo,material); m.castShadow=true; m.receiveShadow=true; parent.add(m);return m;
}
function oval(parent,m,x,y,z,rx,ry,rz){
  const o=mesh(parent,sphere,m);o.position.set(x,y,z);o.scale.set(rx,ry,rz);return o;
}
function rod(parent,a,b,r,material) {
  const d=b.clone().sub(a),o=mesh(parent,rodGeometry,material);
  o.quaternion.setFromUnitVectors(yAxis,d.clone().normalize());o.scale.set(r,d.length(),r);o.position.copy(a).lerp(b,.5);return o;
}
function group(parent){const g=new T.Group();parent.add(g);return g;}
function materialBand(geo,start,count,index){
  const prev=geo.groups.at(-1);
  if(prev&&prev.materialIndex===index&&prev.start+prev.count===start)prev.count+=count;
  else geo.addGroup(start,count,index);
}

// Elliptic anatomical cross-sections. Extra columns offset the rings in depth and width.
function shell(rows,material,parent,n=36,mod=null){
  const vertices=[],uv=[],ids=[],geo=new T.BufferGeometry();
  const bottom=rows[0][0],h=rows.at(-1)[0]-bottom;
  for(const [i,[y,rx,rz,cz=0,cx=0]] of rows.entries()){
    for(let k=0;k<=n;k++){
      const u=k/n,a=Math.PI*.5+u*Math.PI*2;
      let p=[cx+Math.sin(a)*rx,y,cz+Math.cos(a)*rz];
      if(mod)p=mod(p,a,i);
      vertices.push(...p);uv.push(u,(y-bottom)/h);
      if(i<rows.length-1&&k<n){
        const j=i*(n+1)+k;ids.push(j,j+1,j+n+1,j+1,j+n+2,j+n+1);
      }
    }
  }
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ids);geo.computeVertexNormals();
  return mesh(parent,geo,material);
}
function jerseyMaterial(away){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle=away?'#577eaa':'#e47f54';ctx.fillRect(0,0,1024,512);
  // Subtle diagonal knit and colour-blocked side panels, front crest and back print.
  ctx.lineWidth=1;ctx.strokeStyle='rgba(105,51,31,.07)';
  ctx.beginPath();for(let x=-512;x<1024;x+=5){ctx.moveTo(x,512);ctx.lineTo(x+512,0);}ctx.stroke();
  for(const x of [0,512,1024]){
    ctx.fillStyle=away?'#345576':'#c96645';ctx.beginPath();ctx.moveTo(x-75,0);ctx.lineTo(x+75,0);ctx.lineTo(x+22,512);ctx.lineTo(x-22,512);ctx.fill();
    ctx.strokeStyle=away?'#abcedf':'#f2bb8e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+78,0);ctx.lineTo(x+24,512);ctx.stroke();
  }
  ctx.fillStyle=away?'#f4f3e7':'#21313a';ctx.textAlign='center';ctx.font='bold 45px Arial';ctx.fillText('KOR',768,154);
  ctx.fillRect(734,169,68,4);ctx.font='bold 21px Arial';ctx.fillText('ASTRA',256,175);
  ctx.fillStyle='#f4dec8';ctx.fillRect(185,124,26,14);ctx.fillStyle='#374858';ctx.fillRect(185,131,26,7);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  return new T.MeshStandardMaterial({map:tex,roughness:.93});
}
function makeHead(group){
  const face=[[-.105,.032,.050,-.021],[-.096,.057,.072,-.015],[-.075,.077,.090,-.008],[-.046,.087,.097,-.005],[-.010,.093,.101,0],[.027,.094,.103,.001],[.065,.09,.10,.007],[.094,.076,.09,.013],[.117,.047,.065,.017],[.126,.003,.006,.018]];
  function crossSection(y){
    let i=0;while(i<face.length-2&&face[i+1][0]<y)i++;
    const a=face[i],b=face[i+1],u=(y-a[0])/(b[0]-a[0]);
    return [y,...a.slice(1).map((v,k)=>T.MathUtils.lerp(v,b[k+1],u))];
  }
  const bump=(x,y,cx,cy,wx,wy)=>Math.exp(-(((x-cx)/wx)**2+((y-cy)/wy)**2));
  function depth(x,y){
    const side=Math.abs(x);
    return .004*bump(side,y,.037,.013,.020,.009)
      -.005*bump(side,y,.036,.028,.027,.010)-.006*bump(side,y,.047,-.006,.028,.015)
      -.013*bump(x,y,0,.002,.010,.031)-.021*bump(x,y,0,-.016,.014,.013)
      -.009*bump(side,y,.011,-.021,.008,.006)-.004*bump(x,y,0,-.049,.024,.008)
      -.006*bump(x,y,0,-.079,.031,.014);
  }
  function frontZ(x,y){const [,rx,rz,cz]=crossSection(y);return cz-rz*Math.sqrt(Math.max(0,1-(x/rx)**2))+depth(x,y);}
  const sections=Array.from({length:62},(_,i)=>crossSection(-.105+i*(.231/61)));
  shell(sections,skin,group,96,([x,y,z],a)=>[x,y,z+Math.max(0,-Math.cos(a))**2*depth(x,y)]);
  for(const s of [-1,1]){
    oval(group,skin,s*.092,.002,.006,.015,.030,.018);
    oval(group,lip,s*.103,.001,.004,.004,.017,.009);
    const eye=oval(group,mat('#b9a691'),s*.035,.013,frontZ(.035,.013)-.001,.014,.0038,.003);
    eye.rotation.y=-s*.39;
    oval(group,hair,s*.035,.013,frontZ(.035,.013)-.004,.0038,.0037,.002);
    const brow=[.018,.027,.040,.051,.056].map((x,i)=>{
      const y=[.024,.028,.030,.028,.026][i];return V(s*x,y,frontZ(x,y)-.0015);
    });
    mesh(group,new T.TubeGeometry(new T.CatmullRomCurve3(brow),12,.0023,6,false),hair);
  }
  const mouth=[-.022,-.012,0,.012,.022].map((x,i)=>{const y=[-.050,-.048,-.049,-.048,-.050][i];return V(x,y,frontZ(x,y)-.0008);});
  mesh(group,new T.TubeGeometry(new T.CatmullRomCurve3(mouth),16,.0017,6,false),lip);
  const hairRows=[[-.035,.092,.097,.008],[-.005,.095,.103,.007],[.034,.098,.106,.006],[.082,.094,.102,.009],[.114,.076,.085,.011],[.134,.043,.055,.004],[.139,.003,.005,-.006]];
  shell(hairRows,hair,group,64,([x,y,z],a,i)=>{
    const front=Math.max(0,-Math.cos(a)), sides=Math.abs(Math.sin(a));
    const hairline=(.093*front+.034*sides)*(1-i/6)**2;
    const wave=.0016*Math.cos(15*a+2*i)*Math.sin(Math.PI*i/7);
    return [x+Math.sin(a)*wave,y+hairline+.008*Math.sin(a)*front,z+Math.cos(a)*wave];
  });
}
function makeShoe(parent,side){
  const shoe=group(parent);
  const rows=[[0,.001,.001,-.052],[0,.054,.130,-.052],[.009,.061,.1305,-.0525],[.025,.061,.130,-.052],[.037,.059,.128,-.051]];
  const shape=([x,y,z])=>[x*(z>.005?.82:1)+side*Math.max(0,-z-.07)*.055,y,z];
  shell(rows,rubber,shoe,44,shape);
  shell([[.018,.061,.130,-.052],[.025,.062,.130,-.052],[.029,.060,.13,-.052]],teal,shoe,44,shape);
  shell([[.029,.059,.127,-.052],[.045,.058,.125,-.051],[.057,.055,.114,-.041],[.068,.051,.093,-.026],[.081,.045,.065,-.002],[.092,.041,.045,.006],[.095,.032,.035,.006]],white,shoe,44,shape);
  oval(shoe,teal,0,.070,-.061,.025,.008,.047).rotation.x=.29;
  for(let i=0;i<4;i++){
    const z=-.096+i*.016,y=.064+i*.005;
    rod(shoe,V(-.026,y,z),V(.026,y+.002,z+.007),.0024,white);
  }
  for(const s of [-1,1]){
    rod(shoe,V(s*.057,.038,-.060),V(s*.054,.056,-.022),.004,ink);
    rod(shoe,V(s*.054,.056,-.022),V(s*.050,.042,.020),.004,ink);
  }
  return shoe;
}
function makeRacket(parent){
  const g=group(parent),carbon=mat('#233137',.37,.32),edge=mat('#e79b5f',.4,.22);
  rod(g,V(0,-.081,0),V(0,.086,0),.0146,ink);
  for(let i=0;i<14;i++)rod(g,V(0,-.079+i*.012,0),V(0,-.077+i*.012,0),.0151,teal);
  rod(g,V(0,.082,0),V(0,.105,0),.010,edge);rod(g,V(0,.10,0),V(0,.356,0),.0036,carbon);
  const center=.442,rx=.103,ry=.128;
  function frame(a){const sn=Math.sin(a),cs=Math.cos(a);return V(rx*Math.sign(cs)*Math.abs(cs)**.92*(1+.07*sn),center+ry*sn,0);}
  const curve=new T.CatmullRomCurve3(Array.from({length:64},(_,i)=>frame(i/64*Math.PI*2)),true);
  mesh(g,new T.TubeGeometry(curve,80,.0055,8,true),carbon);
  for(const [from,to] of [[.28,1.03],[1.98,2.79],[4.00,4.39],[5.02,5.42]]){
    const pts=Array.from({length:12},(_,i)=>frame(from+(to-from)*i/11));
    mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts),12,.0058,8,false),edge);
  }
  const strings=[];
  for(let i=-9;i<=9;i++){
    const x=i*.010,y=ry*Math.sqrt(1-(x/rx)**2);
    strings.push(x,center-y,0,x,center+y,0);
  }
  for(let i=-11;i<=11;i++){
    const y=i*.010,w=rx*Math.sqrt(1-(y/ry)**2)*(1+.07*y/ry);
    strings.push(-w,center+y,.0004,w,center+y,.0004);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(strings,3));
  g.add(new T.LineSegments(geo,new T.LineBasicMaterial({color:'#edf0d7',transparent:true,opacity:.54})));return g;
}
// A single deforming surface spans each bent knee or elbow, including the crease.
function limb(parent,rows,materials){
  const n=28,geo=new T.BufferGeometry(),v=new Float32Array(rows.length*(n+1)*3),ids=[];
  for(let i=0;i<rows.length-1;i++){
    const start=ids.length;
    for(let k=0;k<n;k++){const j=i*(n+1)+k;ids.push(j,j+1,j+n+1,j+1,j+n+2,j+n+1);}
    materialBand(geo,start,ids.length-start,rows[i][5]||0);
  }
  geo.setAttribute('position',new T.BufferAttribute(v,3).setUsage(T.DynamicDrawUsage));geo.setIndex(ids);
  const obj=mesh(parent,geo,materials);obj.frustumCulled=false;
  const dir=V(),normal=V(),right=V(),center=V(),upper=V(),lower=V(),p=V(),back=V();
  return (a,b,c,sideAxis,twist=0)=>{
    upper.subVectors(b,a).normalize();lower.subVectors(c,b).normalize();
    for(let i=0;i<rows.length;i++){
      const [t,rx,rz,offset=0,bulge=0]=rows[i];
      if(t<=1)center.copy(a).lerp(b,t);else center.copy(b).lerp(c,t-1);
      const f=Math.max(0,Math.min(1,(t-.85)/.30));dir.copy(upper).lerp(lower,f).normalize();
      // Bend plane gives stable elbow flexion and cuff twist for overhead extension.
      right.copy(sideAxis).addScaledVector(dir,-sideAxis.dot(dir));
      if(right.lengthSq()<.018)right.crossVectors(dir,V(0,0,1));
      right.normalize().applyAxisAngle(dir,twist*T.MathUtils.smoothstep(t,1,2));normal.crossVectors(right,dir).normalize();
      back.copy(normal).multiplyScalar(offset);center.add(back);
      for(let k=0;k<=n;k++){
        const a=k/n*Math.PI*2,ex=Math.sin(a),ez=Math.cos(a);
        p.copy(center).addScaledVector(right,rx*ex).addScaledVector(normal,rz*ez+bulge*Math.max(0,ez)**2);
        p.toArray(v,3*(i*(n+1)+k));
      }
    }
    geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();
  };
}
function handModel(parent,s){
  const g=group(parent);
  oval(g,skin,0,0,0,.034,.050,.023);
  for(let i=0;i<4;i++){
    const x=(i-1.5)*.0138, len=[.041,.046,.043,.035][i];
    const bend=s===1?.023:.010;
    const a=V(x,-.027,-.004),b=V(x,-.029-len*.60,-bend*.50),c=V(x,-.026-len*.79,-bend);
    rod(g,a,b,.0076,skin);oval(g,skin,b.x,b.y,b.z,.0079,.008,.008);rod(g,b,c,.0071,skin);
    oval(g,skin,c.x,c.y,c.z,.0072,.007,.007);
  }
  oval(g,skin,-s*.031,-.003,-.012,.012,.026,.012).rotation.z=-s*.5;return g;
}
function racketHand(parent){
  const hand=group(parent);
  oval(hand,skin,0,0,.019,.031,.044,.020);
  for(let i=0;i<4;i++){
    const y=.025-i*.016;
    const path=[V(.018,y,.023),V(.031,y-.002,.008),V(.027,y-.005,-.009),V(.012,y-.007,-.019),V(-.003,y-.005,-.016)];
    mesh(hand,new T.TubeGeometry(new T.CatmullRomCurve3(path),15,.0076-i*.0004,8,false),skin);
    oval(hand,skin,-.003,y-.005,-.016,.007,.007,.007);
  }
  const thumb=[V(-.019,.000,.023),V(-.031,.011,.013),V(-.027,.025,-.004),V(-.012,.020,-.014)];
  mesh(hand,new T.TubeGeometry(new T.CatmullRomCurve3(thumb),14,.009,8,false),skin);
  return hand;
}
function fabricRings(parent,count,materials,bands){
  const geo=new T.BufferGeometry(),positions=new T.Float32BufferAttribute(new Float32Array((bands.length+1)*count*3),3);
  positions.setUsage(T.DynamicDrawUsage);geo.setAttribute('position',positions);
  const ids=[];
  for(let row=0;row<bands.length;row++){
    const start=ids.length;
    for(let k=0;k<count;k++){
      const a=row*count+k,b=row*count+(k+1)%count;
      ids.push(a,b,a+count,b,b+count,a+count);
    }
    materialBand(geo,start,ids.length-start,bands[row]);
  }
  geo.setIndex(ids);mesh(parent,geo,materials).frustumCulled=false;
  return {point(row,k,v){positions.setXYZ(row*count+k,v.x,v.y,v.z);},finish(){positions.needsUpdate=true;geo.computeVertexNormals();}};
}
// Each trouser leg shares half of the waistband and the same curved crotch seam.
function trouserLeg(body,sign){
  const n=40,surface=fabricRings(body,n,[shorts,teal],[0,0,0,1,0]);
  const down=V(0,-1,0),ax=V(),p=V(),top=V(),mid=V(),point=V(),q=new T.Quaternion(),localDir=V();
  const rows=[[.26,.106,.11],[.46,.097,.101],[.50,.095,.100],[.516,.095,.099],[.55,.093,.097]];
  return (j,hipQ,s)=>{
    ax.subVectors(j['knee'+s],j['hip'+s]).normalize();
    localDir.copy(ax).applyQuaternion(hipQ.clone().invert());
    q.setFromUnitVectors(down,localDir).premultiply(hipQ);
    for(let k=0;k<n;k++){
      const a=k/n*Math.PI*2,x=Math.cos(a),z=Math.sin(a),inner=Math.max(0,-sign*x);
      top.set(sign*Math.max(0,sign*x)*.157,.074-inner*.176,.113*z+.007).applyQuaternion(hipQ).add(j.pelvis);
      surface.point(0,k,top);
      rows.forEach(([u,rx,rz],i)=>{
        mid.copy(j['hip'+s]).lerp(j['knee'+s],u);
        p.set(rx*x,0,rz*z+.004).applyQuaternion(q).add(mid);
        if(i===0){point.copy(top).lerp(p,.76);surface.point(i+1,k,point);}else surface.point(i+1,k,p);
      });
    }
    surface.finish();
  };
}
// Cut actual armholes in the shirt. Sew sleeve rings to their moving perimeter.
function cutSleeves(body,jersey,rest,sleeveMaterial){
  const geo=jersey.geometry,n=64,stride=65,lo=7,hi=11,span=7;
  const index=Array.from(geo.index.array),keep=[];
  for(let i=0;i<index.length;i+=6){
    const cell=i/6,row=Math.floor(cell/n),k=cell%n;
    if(row>=lo&&row<hi&&(k<span||k>=n-span||(k>=32-span&&k<32+span)))continue;
    keep.push(...index.slice(i,i+6));
  }
  geo.setIndex(keep);
  return Object.fromEntries(['L','R'].map(s=>{
    const sign=s==='R'?1:-1,c=sign===1?0:32,edge=[];
    const add=(r,k)=>edge.push(r*stride+(k+n)%n);
    for(let k=c-span;k<c+span;k++)add(lo,k);
    for(let r=lo;r<hi;r++)add(r,c+span);
    for(let k=c+span;k>c-span;k--)add(hi,k);
    for(let r=hi;r>lo;r--)add(r,c-span);
    const surface=fabricRings(body,edge.length,[sleeveMaterial,ink],[0,0,0,1,0]);
    const radial=edge.map(i=>V(0,(rest[i*3+1]-.354)/.090,(rest[i*3+2]-.001)/.081).normalize());
    const pos=V(),outer=V(),v=V(),dir=V(),local=V(),q=new T.Quaternion(),side=V(sign,0,0);
    return [s,(p)=>{
      const shoulder=p.j['shoulder'+s],elbow=p.j['elbow'+s];
      dir.subVectors(elbow,shoulder).normalize();local.copy(dir).applyQuaternion(p.trunkQ.clone().invert());
      q.setFromUnitVectors(side,local).premultiply(p.trunkQ);
      for(let k=0;k<edge.length;k++){
        pos.fromBufferAttribute(geo.attributes.position,edge[k]).add(p.j.pelvis);surface.point(0,k,pos);
        for(const [i,u,r] of [[1,.14,.073],[2,.34,.067],[3,.425,.061],[4,.445,.061],[5,.47,.060]]){
          outer.copy(radial[k]).multiplyScalar(r).applyQuaternion(q).add(shoulder).addScaledVector(dir,u*shoulder.distanceTo(elbow));
          if(i===1)v.copy(pos).lerp(outer,.66);else v.copy(outer);
          surface.point(i,k,v);
        }
      }
      surface.finish();
    }];
  }));
}
export function createAthlete(scene,away=false){
  const body=group(scene),torso=group(body),hips=group(body),head=group(body);
  const jersey=shell([[.069,.158,.114,.007],[.074,.163,.118,.007],[.080,.166,.120,.007],[.093,.165,.118,.007],[.11,.159,.113,.005],[.135,.155,.106,.002],[.19,.159,.108,0],[.27,.181,.126,-.004],[.34,.199,.134,-.007],[.39,.212,.122,-.004],[.416,.213,.105,.003],[.439,.175,.094,.007],[.453,.105,.077,.003],[.459,.064,.066,-.002]],jerseyMaterial(away),body,64);
  const shirtPosition=jersey.geometry.attributes.position,shirtRest=shirtPosition.array.slice();
  const sleeves=cutSleeves(body,jersey,shirtRest,away?mat('#577eaa'):peach);
  const clothPoint=V(),clothRotation=new T.Quaternion();
  shell([[.453,.073,.068],[.461,.069,.065],[.465,.062,.059]],ink,torso);
  shell([[.061,.158,.114,.007],[.074,.157,.113,.007],[.080,.154,.11,.007]],shorts,hips);
  shell([[.435,.060,.057],[.475,.055,.054],[.515,.052,.056],[.549,.059,.058]],skin,torso);
  makeHead(head);
  const armRows=[
    [.43,.049,.053],[.50,.053,.056],[.66,.055,.059,.002],[.84,.044,.049],[1,.040,.042,-.002],[1.15,.046,.048,.002],[1.3,.046,.047],[1.57,.037,.036],[1.82,.028,.029],[2,.024,.024],[2.05,.021,.02]];
  const legRows=[
    [.47,.079,.084],[.60,.077,.081],[.76,.067,.073],[.90,.058,.060,.001],[1,.053,.058,.001,.004],[1.12,.051,.055,-.004],[1.28,.057,.063,-.012],[1.42,.054,.060,-.011],[1.58,.044,.049,-.009],[1.67,.037,.041,-.005,0,3],[1.69,.039,.043,-.006,0,3],[1.72,.038,.042,-.006,0,4],[1.74,.038,.041,-.006,0,3],[1.85,.031,.035,0,0,3],[1.86,.032,.036,0,0,3],[2,.032,.034,0,0,3]];
  const limbs={};
  for(const s of ['L','R']){
    const sign=s==='R'?1:-1;
    limbs[s]={trousers:trouserLeg(body,sign),arm:limb(body,armRows,[skin,peach,ink]),leg:limb(body,legRows,[skin,shorts,teal,white,teal]),shoe:makeShoe(body,sign),hand:s==='R'?racketHand(body):handModel(body,sign)};
  }
  const racket=makeRacket(body),rightAxis=V(1,0,0),wristBridge=oval(body,skin,0,0,0,.021,.035,.022);
  return {update(p){
    const {j}=p;
    jersey.position.copy(j.pelvis);
    for(let i=0;i<shirtPosition.count;i++){
      clothPoint.fromArray(shirtRest,3*i);
      if(i%65===0)clothRotation.copy(p.hipQ).slerp(p.trunkQ,T.MathUtils.smoothstep(clothPoint.y,-.015,.26));
      clothPoint.applyQuaternion(clothRotation);
      shirtPosition.setXYZ(i,clothPoint.x,clothPoint.y,clothPoint.z);
    }
    shirtPosition.needsUpdate=true;jersey.geometry.computeVertexNormals();
    torso.position.copy(j.pelvis);torso.quaternion.copy(p.trunkQ);
    hips.position.copy(j.pelvis);hips.quaternion.copy(p.hipQ);
    head.position.copy(j.head);head.quaternion.copy(p.headQ);
    for(const s of ['L','R']){
      const l=limbs[s];
      sleeves[s](p);l.trousers(j,p.hipQ,s);
      l.arm(j['shoulder'+s],j['elbow'+s],j['wrist'+s],rightAxis.clone().applyQuaternion(p.trunkQ),s==='R'?p.forearmTwist:0);
      l.leg(j['hip'+s],j['knee'+s],j['ankle'+s],rightAxis.clone().applyQuaternion(p.feet[s].q));
      l.shoe.position.copy(p.feet[s].sole);l.shoe.quaternion.copy(p.feet[s].q);
      const fore=j['hand'+s].clone().sub(j['wrist'+s]).normalize();
      if(s==='L'){
        l.hand.position.copy(j.wristL).lerp(j.handL,.56);l.hand.quaternion.setFromUnitVectors(V(0,-1,0),fore);
      }else{
        const back=fore.clone().negate();back.addScaledVector(p.racketDir,-back.dot(p.racketDir));
        if(back.lengthSq()<.002)back.set(0,0,1).addScaledVector(p.racketDir,-p.racketDir.z);
        back.normalize();
        const right=p.racketDir.clone().cross(back).normalize();
        l.hand.position.copy(j.handR);l.hand.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,p.racketDir,back));
        const palm=j.handR.clone().addScaledVector(back,.021).addScaledVector(p.racketDir,T.MathUtils.clamp(-.052*fore.dot(p.racketDir),-.028,.028));
        const link=palm.clone().sub(j.wristR);
        wristBridge.position.copy(j.wristR).lerp(palm,.50);wristBridge.scale.y=.012+link.length()*.50;
        wristBridge.quaternion.setFromUnitVectors(yAxis,link.normalize());
      }
    }
    racket.visible=p.racketObserved!==false;
    racket.position.copy(j.handR);racket.quaternion.setFromUnitVectors(yAxis,p.racketDir);
    racket.rotateY(p.roll*Math.PI/180);
  }};
}

