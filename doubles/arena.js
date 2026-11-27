import * as T from 'three';

// One draw call per material for the repeated seating, stairs, and roof members.
export function buildStands(scene){
  const batches=new Map();
  const transform=new T.Object3D();
  function block(color,x,y,z,w,h,d,turn=0,tilt=0){
    if(!batches.has(color))batches.set(color,[]);
    transform.position.set(x,y,z);transform.rotation.set(0,turn,0);transform.rotateX(tilt);
    transform.scale.set(w,h,d);transform.updateMatrix();batches.get(color).push(transform.matrix.clone());
  }
  // Each tier faces the playing surface. Gaps between blocks form access aisles.
  for(const [azimuth,distance,count] of [[0,12.2,46],[Math.PI,12.2,46],[Math.PI/2,9.6,38],[-Math.PI/2,9.6,38]]){
    const c=Math.cos(azimuth),s=Math.sin(azimuth);
    function seat(color,x,y,z,w,h,d,tilt=0){
      block(color,c*x+s*z,y,-s*x+c*z,w,h,d,azimuth,tilt);
    }
    for(let row=0;row<12;row++){
      const z=distance+row*.83,top=.42+row*.44;
      seat('#242d37',0,top/2,z,count*.56+.8,top,.85);
      for(let col=0;col<count;col++){
        const x=(col-(count-1)/2)*.56;
        if(col%12===5||col%12===6){
          seat('#65707b',x,top+.025,z-.34,.55,.045,.09);continue;
        }
        const tone=['#24405a','#294963','#213b50','#334f63'][(row*3+col*7)%4];
        seat(tone,x,top+.22,z,.45,.10,.38);
        seat(tone,x,top+.40,z+.17,.46,.35,.065,-.13);
      }
    }
    for(let i=-5;i<=5;i++){
      seat('#34404e',i*2.16,8.25,distance+9.72,.07,5.1,.12);
    }
    seat('#334758',0,5.92,distance+9.52,count*.56,.14,.28);
    seat('#111b28',0,8.10,distance+10,count*.57+1,5.2,.35);
    seat('#17242f',0,.58,distance-.60,count*.57,1.10,.15);
    seat('#4f6370',0,1.16,distance-.60,count*.57,.035,.15);
  }
  // The lowest overhead structure is above 16 m. Dark roof preserves shuttle contrast.
  for(let z=-21;z<=21;z+=5.25){
    block('#263441',0,16.8,z,43,.15,.16);block('#25323c',0,17.55,z,43,.13,.15);
    for(let x=-19;x<20;x+=2)block('#394955',x,17.18,z,.08,.83,.08,0);
    for(const x of [-8.4,8.4])block('#d6e6e8',x,16.68,z,2.6,.06,.30);
  }
  block('#172430',0,18.15,0,54,.22,56);
  for(const [x,z,w,d] of [[-22,0,.3,54],[22,0,.3,54],[0,-24,46,.3],[0,24,46,.3]])block('#182432',x,8.5,z,w,17,d);
  const geom=new T.BoxGeometry();
  for(const [color,matrices] of batches){
    const light=color==='#d6e6e8';
    const material=light?new T.MeshBasicMaterial({color}):new T.MeshStandardMaterial({color,roughness:.9});
    const mesh=new T.InstancedMesh(geom,material,matrices.length);
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();scene.add(mesh);
  }
}

export function arenaScoreboard(scene){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=320;
  const ctx=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  const screen=new T.Mesh(new T.PlaneGeometry(8.5,2.65),new T.MeshBasicMaterial({map:texture,toneMapped:false}));
  screen.position.set(0,8.25,-21.45);scene.add(screen);
  let last='';
  return scores=>{
    const key=scores.join('-');if(last===key)return;last=key;
    ctx.fillStyle='#14232c';ctx.fillRect(0,0,1024,320);
    ctx.fillStyle='#b5d950';ctx.fillRect(0,0,1024,6);
    ctx.textAlign='center';ctx.fillStyle='#a9b9ba';ctx.font='600 29px Arial';ctx.fillText('COURT 01     /     DOUBLES',512,57);
    ctx.fillStyle='#73948e';ctx.font='700 34px Arial';ctx.fillText('HOME',228,241);ctx.fillText('AWAY',796,241);
    ctx.font='700 126px Arial';ctx.fillStyle='#d4e979';ctx.fillText(String(scores[0]).padStart(2,'0'),228,186);
    ctx.fillStyle='#f4ad8f';ctx.fillText(String(scores[1]).padStart(2,'0'),796,186);
    ctx.fillStyle='#678080';ctx.fillRect(498,125,28,5);texture.needsUpdate=true;
  };
}
