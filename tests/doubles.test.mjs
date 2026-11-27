import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,defaults,readSwing,contactQuality} from '../doubles/simulation.js';
import {trace,integrate} from '../physics.js';
const stroke=(dx,dy,z,net=false)=>readSwing([{x:0,y:0,t:0},{x:dx,y:dy,t:150}],.15,z,net);
function strikeAt(type,power,error,y=-3,z=2.4){
 const game=createMatch({...defaults}),s=game.s;game.start();
 Object.assign(s.players[0],{x:0,y:y-.45});
 Object.assign(s,{phase:'rally',last:2,ball:{x:0,y,z,vx:0,vy:0,vz:0},plan:{actor:0,human:{at:.065-error}}});
 const radius=60*power;
 const points=type==='cut'?Array.from({length:25},(_,i)=>{
  const angle=Math.PI*i/24;return {x:radius*Math.sin(angle),y:radius*(1-Math.cos(angle)),t:i*6};
 }):[{x:0,y:0,t:0},{x:type==='drive'?120*power:0,y:type==='smash'||type==='drop'?120*power:type==='clear'?-120*power:0,t:144}];
 game.swing('fore',points,.144);
 for(let i=0;i<12&&!s.lastShot;i++)game.tick(1/120);
 assert.ok(s.lastShot);
 return {game,shot:s.lastShot,landing:trace(s.ball)};
}
test('one smash from the rear court: power scales pace, clean contact beats the same mistimed swing',()=>{
 for(const y of [-6,-5,-4]){
  const light=strikeAt('smash',.65,0,y,2.3),hard=strikeAt('smash',1,0,y,2.3),late=strikeAt('smash',1,.28,y,2.3);
  assert.equal(light.shot.type,'smash');assert.ok(light.shot.angle<0&&hard.shot.angle<0);
  assert.ok(hard.shot.speed>light.shot.speed*1.15&&hard.shot.speed>late.shot.speed);
  for(const strike of [light,hard,late])assert.ok(strike.landing.netHeight>1.524&&strike.landing.netHeight<2.01);
 }
});
// Landing past the net from every hit position the user gave (2026-11-28): power and impact
// must reach both ends of each range.
const within=(v,[a,b],why)=>assert.ok(v>=a-.06&&v<=b+.06,`${why}: ${v.toFixed(2)} not in ${a}-${b}`);
test('smash, clear and drop from -6 to -4 m reach both ends of their landing ranges',()=>{
 for(const y of [-6,-5,-4]){
  const weak=strikeAt('smash',.6,0,y,2.3),full=strikeAt('smash',1,0,y,2.3);
  within(weak.landing.y,[4,4.1],`weak smash ${y}`);within(full.landing.y,[5.9,6],`full smash ${y}`);
  const short=strikeAt('clear',.1,0,y,2.25),long=strikeAt('clear',1,0,y,2.25);
  assert.equal(long.shot.type,'clear');
  within(short.landing.y,[4,4.3],`short clear ${y}`);within(long.landing.y,[5.9,6],`long clear ${y}`);
  within(short.landing.apex,[6,6.3],`short clear apex ${y}`);within(long.landing.apex,[7.8,8],`long clear apex ${y}`);
  for(const power of [.15,.55]){
   const drop=strikeAt('drop',power,0,y,2.3);assert.equal(drop.shot.type,'drop');
   within(drop.landing.y,[1,2],`drop ${y}`);
   // The contact is the highest point of a drop.
   assert.ok(drop.shot.angle<=0&&drop.landing.apex<=2.3+1e-9&&drop.landing.netHeight>1.524&&drop.landing.netHeight<1.9);
  }
 }
});
test('drives: 3-6 m from above the tape, 4-6 m from below it, rising to 1.55-2.0 m at the net and peaking past it',()=>{
 for(const y of [-5,-2]){
  for(const [z,near] of [[1.85,3],[1.4,4]]){
   const soft=strikeAt('drive',0,0,y,z),hard=strikeAt('drive',1,0,y,z);
   within(soft.landing.y,[near,near+.2],`soft drive ${y} ${z}`);within(hard.landing.y,[5.9,6],`hard drive ${y} ${z}`);
   assert.ok(hard.shot.speed<200);
  }
  const low=strikeAt('drive',.6,0,y,1.4),f=flightOf(low.game.s.ball);
  assert.ok(f.net>=1.55&&f.net<=2.0&&f.apex>0,`low drive ${y}: net ${f.net} apex ${f.apex}`);
 }
});
test('cuts struck below the tape are slow, climb over the net and turn over 0.5-0.7 m past it',()=>{
 for(const y of [-5,-4,-3])for(const z of [1.0,1.4])for(const power of [.22,.6,1]){
  const cut=strikeAt('cut',power,0,y,z),f=flightOf(cut.game.s.ball);
  assert.ok(cut.shot.speed<115,`speed ${cut.shot.speed}`);
  assert.ok(f.net>=1.55&&f.net<=2.0&&f.apex>=.45&&f.apex<=.75,`${y} ${z} ${power}: net ${f.net} apex ${f.apex}`);
  within(cut.landing.y,z<1.25?[1,3]:[1,3.5],`cut ${y} ${z} ${power}`);
 }
});
test('an early cut graded GOOD floats but stays at or below 2.0 m over the net, even from a high contact',()=>{
 for(const y of [-5,-4,-3])for(const z of [1.1,1.8,1.95])for(const power of [.3,1]){
  const early=strikeAt('cut',power,-.2,y,z);assert.equal(early.game.grade(-.2),'GOOD');
  assert.ok(early.landing.netHeight>1.524&&early.landing.netHeight<=2.0,`${y} ${z} ${power}: ${early.landing.netHeight}`);
 }
});
test('a smash swung at a shuttle at or above 2.0 m stays a smash at a lower contact',()=>{
 const hard=[{x:0,y:0,t:0},{x:0,y:110,t:120}];
 assert.equal(readSwing(hard,.12,1.85,false,2.1).type,'smash');assert.equal(readSwing(hard,.12,1.85,false,1.95).type,'drive');
 const game=createMatch({...defaults}),s=game.s;game.start();
 Object.assign(s.players[0],{x:0,y:-5.45});
 Object.assign(s,{phase:'rally',last:2,ball:{x:0,y:-5,z:2.05,vx:0,vy:0,vz:-5},plan:{actor:0,human:{at:.065}}});
 game.swing('fore',hard,.12);for(let i=0;i<12&&!s.lastShot;i++)game.tick(1/120);
 assert.equal(s.lastShot.type,'smash');assert.ok(s.players[0].hit.z<2.0&&s.lastShot.angle<=0);
 const r=trace(s.ball);assert.ok(r.netHeight>1.524&&r.y>=3.9&&r.y<=6.1);
});
function flightOf(ball){
 const b={...ball},side=Math.sign(b.vy)||1;let net=null,top=b.z,apex=b.y*side;
 for(let i=0;i<900&&b.z>0;i++){const y=b.y,z=b.z;integrate(b,1/120);if(y*b.y<=0&&y!==b.y)net=z+(b.z-z)*(-y/(b.y-y));if(b.z>top){top=b.z;apex=b.y*side;}}
 return {net,top,apex};
}
test('drives from 2-5 m land 3-6 m past the net at any power or timing',()=>{
 for(const y of [-5,-3.5,-2])for(const z of [1.4,1.85])for(const power of [.3,.85])for(const error of [0,.28]){
  const d=strikeAt('drive',power,error,y,z);assert.equal(d.shot.type,'drive');
  assert.ok(d.landing.netHeight>1.524&&d.landing.y>=2.95&&d.landing.y<=6.05,`${y} ${z} ${power} ${error} -> ${d.landing.y}`);
 }
});
test('drive trajectory responds to impact timing, racket power and a low defensive contact',()=>{
 // Drive band 1.25-2.0 m: above the tape a clean drive leaves flat or downward.
 const clean=strikeAt('drive',.85,0,-3,1.9),mistimed=strikeAt('drive',.85,.28,-3,1.9),soft=strikeAt('drive',.3,0,-3,1.9);
 assert.ok(clean.shot.angle<=0&&mistimed.shot.angle>0);
 assert.ok(clean.shot.speed>mistimed.shot.speed&&clean.shot.speed>soft.shot.speed);
 const defensive=strikeAt('drive',.85,0,-3,1.1);assert.ok(defensive.shot.angle>0&&defensive.landing.netHeight>1.524);
});
test('cuts from three to five metres land 1-3.5 m (attacking) or 1-3 m (defensive) and can float or lose the point at the net',()=>{
 for(const y of [-3,-4,-5])for(const z of [1.1,1.8]){
  const short=strikeAt('cut',.30,0,y,z),deep=strikeAt('cut',.85,0,y,z);
  assert.equal(short.shot.type,z<1.25?'block':'slice');
  assert.ok(short.landing.y>=.95&&deep.landing.y<=(z<1.25?3.05:3.55)&&deep.landing.y-short.landing.y>1);
  assert.ok(short.landing.netHeight>1.524&&deep.landing.netHeight>1.524);
  // Defensive cut climbs over the tape; the attacking cut (1.25-2.0 m) leaves nearly straight.
  assert.ok(z<1.25?deep.shot.angle>10:Math.abs(deep.shot.angle)<6);
  const early=strikeAt('cut',.85,-.28,y,z),late=strikeAt('cut',.85,.28,y,z);
  assert.ok(early.landing.netHeight>deep.landing.netHeight+.25);
  // A late cut still graded GOOD skims the tape; only BAD timing catches the net.
  for(const error of [.12,.2]){const good=strikeAt('cut',.85,error,y,z);assert.ok(good.landing.netHeight>1.524&&good.landing.netHeight<deep.landing.netHeight+1e-6);}
  const {game}=late;
  for(let i=0;i<360&&game.s.phase==='rally';i++)game.tick(1/120);
  assert.deepEqual(game.s.score,[0,1]);assert.match(game.s.feedback,/네트/);
 }
});
test('shot preview and release agree at the displayed power and height boundaries',()=>{
 // Smash only from 2.0 m; a hard downward swing between 1.55 and 2.0 m is an attacking drive.
 for(const [dy,z,expected] of [[71,2.0,'drop'],[72,2.0,'smash'],[72,1.99,'drive'],[71,1.6,'drop'],[-48,1.55,'clear'],[-47,1.54,'block'],[-48,1.54,'lift']]){
  const slow=readSwing([{x:0,y:0,t:0},{x:0,y:dy,t:900}],.9,z,false);
  assert.equal(slow.type,expected);assert.equal(stroke(0,dy,z).type,expected);
  assert.equal(slow.power,Math.abs(dy)/120);
 }
});
test('played drops skim the net and powered clears climb and land progressively deeper',()=>{
 function flight(dy){
  const game=createMatch({...defaults}),s=game.s;game.start();
  Object.assign(s.players[0],{x:0,y:-4.45});
  Object.assign(s,{phase:'rally',last:2,ball:{x:0,y:-4,z:2.25,vx:0,vy:0,vz:0},plan:{actor:0,human:{at:.065}}});
  const path=[{x:0,y:0,t:0},{x:0,y:dy,t:150}],preview=game.preview(path,.15);
  game.swing('fore',path,.15);
  for(let step=0;step<12&&!s.lastShot;step++)game.tick(1/120);
  assert.equal(s.lastShot.type,preview.type);assert.equal(s.lastShot.power,preview.power);
  const live=trace(s.ball,1/120),forecast=trace(s.ball,1/80);
  assert.ok(Math.abs(live.y-forecast.y)<.05);
  return live;
 }
 const soft=flight(24),firm=flight(65),low=flight(-30),medium=flight(-72),high=flight(-120);
 for(const drop of [soft,firm]){
  assert.ok(drop.netHeight>1.524&&drop.netHeight<1.85);
  assert.ok(drop.y>0&&drop.y<1.98);assert.ok(drop.apex<2.6);
 }
 assert.ok(soft.y<firm.y);
 assert.ok(low.y<medium.y&&medium.y<high.y&&high.y<6.7);
 assert.ok(low.apex<medium.apex&&medium.apex<high.apex);
 assert.ok(high.time>low.time&&low.time>soft.time);
});
test('doubles gestures distinguish height, net position, continuous angle and curved paths',()=>{
 assert.equal(stroke(0,0,.85).type,'drive');assert.equal(stroke(0,0,.85,true).type,'net');
 assert.equal(stroke(-80,4,1.2,true).type,'crossNet');assert.equal(stroke(-80,4,1.2).type,'drive');
 assert.equal(stroke(5,24,2.28).type,'drop');assert.equal(stroke(35,100,2.28).type,'smash');
 assert.ok(stroke(72,100,2.28).aim>stroke(35,100,2.28).aim);
 assert.equal(stroke(2,-70,2.2).type,'clear');assert.equal(stroke(1,-96,.8).type,'lift');assert.equal(stroke(1,-20,.8).type,'block');
 const arc=Array.from({length:19},(_,i)=>({x:40*Math.cos(i*Math.PI/18),y:40*Math.sin(i*Math.PI/18),t:i*15}));
 assert.equal(readSwing(arc,.27,2,false).type,'slice');assert.equal(readSwing(arc,.27,.8,false).type,'block');
 assert.notEqual(readSwing([{x:0,y:0,t:0},{x:60,y:0,t:100},{x:60,y:60,t:200}],.2,2,false).type,'slice');
});
test('rackethand, physical reach, distinct timing speeds and jumping on a fixed return',()=>{
 function play(delay,far=false){
  const g=createMatch({...defaults}),s=g.s;g.start();const p=s.players[0];p.x=0;p.y=-3;
  Object.assign(s,{phase:'rally',last:2,ball:{x:far?2.8:.15,y:-2.55,z:1.97,vx:0,vy:-.75,vz:-.1},plan:{actor:0,human:{at:.065-delay}}});
  g.swing('fore',[{x:0,y:0,t:0}],.08);for(let i=0;i<10;i++)g.tick(1/120);
  return s;
 }
 const perfect=play(0),late=play(.3);assert.equal(perfect.last,0);assert.equal(perfect.lastShot.hand,'fore');assert.equal(perfect.lastShot.type,'drive');assert.ok(perfect.lastShot.speed>late.lastShot.speed);assert.equal(play(0,true).last,2);
 assert.ok(contactQuality(.12)>contactQuality(.13));
 const g=createMatch({...defaults});g.start();g.jump();for(let i=0;i<40;i++)g.tick(1/120);assert.ok(g.s.players[0].jump>.6);
 for(let i=0;i<80;i++)g.tick(1/120);assert.equal(g.s.players[0].jump,0);
});
test('doubles AI serves, receives, swaps service courts and honors the doubles sidelines',()=>{
 const g=createMatch({...defaults},()=>.43),s=g.s;g.start();
 assert.equal(s.players.length,4);assert.equal(s.receiver,2);g.swing('back',[{x:0,y:0,t:0}],.07);assert.equal(s.lastShot.hand,'back');
 for(let i=0;i<210&&s.last===0;i++)g.tick(1/120);assert.equal(s.last,2);
 Object.assign(s,{phase:'rally',ball:{x:2.9,y:4.6,z:.001,vx:0,vy:0,vz:-1},last:0,serviceFlight:false});g.tick(1/120);
 assert.deepEqual(s.score,[1,0]);for(let i=0;i<155;i++)g.tick(1/120);assert.equal(s.server,0);assert.ok(s.players[0].x<0);assert.equal(s.receiver,3);
 const x=s.players[0].x;g.resize(7,15);assert.ok(Math.abs(s.players[0].x-x*7/6.1)<1e-8);assert.equal(s.settings.length,15);
});

test('opposing doubles server leaves a full preparation interval after players reset',()=>{
 const match=createMatch({...defaults},()=>.9),s=match.s;
 match.start();s.phase='point';s.server=2;s.deadline=s.time;match.tick(1/120);
 assert.equal(s.phase,'serve');
 const ready=s.time;
 for(let i=0;i<419;i++)match.tick(1/120);
 assert.equal(s.phase,'serve');assert.equal(s.ball.vz,0);
 for(let i=0;i<3;i++)match.tick(1/120);
 assert.equal(s.phase,'rally');assert.equal(s.lastShot.id,2);assert.ok(s.lastShot.at-ready>=3.5);
});
test('contact-height bands: smash from 2.0 m, attacking cut from 1.25 m',()=>{
 const arc=Array.from({length:19},(_,i)=>({x:40*Math.cos(i*Math.PI/18),y:40*Math.sin(i*Math.PI/18),t:i*15}));
 assert.equal(readSwing(arc,.27,1.25,false).type,'slice');assert.equal(readSwing(arc,.27,1.24,false).type,'block');
 assert.equal(readSwing(arc,.27,2.0,false).type,'slice');
 const hard=[{x:0,y:0,t:0},{x:0,y:110,t:120}];
 assert.equal(readSwing(hard,.12,2.5,false).type,'smash');assert.equal(readSwing(hard,.12,2.0,false).type,'smash');assert.equal(readSwing(hard,.12,1.9,false).type,'drive');
});
