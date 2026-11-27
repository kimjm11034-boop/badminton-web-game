import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,defaults,readSwing,contactQuality} from '../doubles/simulation.js';
const stroke=(dx,dy,z,net=false)=>readSwing([{x:0,y:0,t:0},{x:dx,y:dy,t:150}],.15,z,net);
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
