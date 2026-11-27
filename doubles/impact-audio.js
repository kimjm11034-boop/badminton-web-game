const sampleByShot = {short:'touch',net:'touch',crossNet:'touch',drop:'touch',block:'touch',slice:'drive',drive:'drive',lift:'drive',long:'drive',clear:'power',smash:'power'};

export function createImpactAudio(){
 let context, loading, buffers, played=0;
 function activate(){
  try{context??=new AudioContext();context.resume().catch(()=>{});}catch{return;}
  loading??=Promise.all(['touch','drive','power'].map(async name=>{
   const response=await fetch('/doubles/assets/audio/'+name+'.wav');
   if(!response.ok)throw Error('Audio '+response.status);
   return [name,await context.decodeAudioData(await response.arrayBuffer())];
  })).then(entries=>{buffers=Object.fromEntries(entries);}).catch(()=>{loading=null;});
 }
 function strike(shot,listener,contact,yaw,volume){
  if(!buffers||context.state!=='running'||volume<=0||!contact)return;
  const dx=contact.x-listener.x,dy=contact.y-listener.y,distance=Math.hypot(dx,dy);
  const strength=Math.min(1,Math.max(.06,shot.speed/220)),soft=sampleByShot[shot.type]==='touch';
  const source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter(),pan=context.createStereoPanner();
  source.buffer=buffers[sampleByShot[shot.type]||'drive'];
  source.playbackRate.value=(soft?.90:1)+strength*.13+(Math.random()-.5)*.05;
  filter.type='lowpass';filter.frequency.value=Math.max(2100,(soft?6000:12000)-distance*310);
  gain.gain.value=volume*(soft?.30:.62)*(.43+.95*Math.sqrt(strength))/(1+.12*distance);
  pan.pan.value=Math.max(-.9,Math.min(.9,(dx*Math.cos(yaw)+dy*Math.sin(yaw))/Math.max(2,distance)));
  source.connect(filter).connect(gain).connect(pan).connect(context.destination);
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();};source.start();played++;
 }
 return {activate,strike,get played(){return played;},get ready(){return !!buffers;}};
}
