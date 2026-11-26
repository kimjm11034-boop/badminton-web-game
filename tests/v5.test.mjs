import test from 'node:test';import assert from 'node:assert/strict';
import {shotVelocity,classify,trace} from '../physics.js';
import {buildPose,updateMotion} from '../motion.js';
const g=(dx,dy,duration=.7)=>({dx,dy,duration,distance:Math.hypot(dx,dy),speed:100,peak:100,power:.3});
test('short down diagonals are drops, only near-horizontal drags are drives',()=>{
 assert.equal(classify(g(-12,11),2.6,-4),'drop');assert.equal(classify(g(-6,5),2.6,-4),'drop');
 assert.equal(classify(g(30,15),2.6,-4),'drop');
 assert.equal(classify(g(80,6),2.0,-4),'drive');
 assert.equal(classify(g(0,0,.1),2,-4),'drive');
});
test('anatomical left/right rotate with athlete facing without crossing legs',()=>{
 for(const side of [-1,1]){
  const p={x:0,y:side*3,vx:0,vy:0,side,swing:-10};
  updateMotion(p,1/240,2);const j=buildPose(p,2).joints;
  assert.ok(j.hipR[0]*-side>0);assert.ok(j.ankleR[0]*-side>0);
  assert.ok(j.hipL[0]*-side<0);assert.ok(j.ankleL[0]*-side<0);
 }
});
test('drive stays flat, push and drop leave the racket downwards',()=>{
 const p={x:0,y:-3,z:2.2};
 const drive=shotVelocity(p,{x:0,y:4.5},'drive');assert.ok(drive.angle<=5);assert.ok(drive.prediction.apex<=2.35);
 const push=shotVelocity({x:0,y:-1,z:2.3},{x:0,y:3.3},'push');assert.ok(push.vz<0);assert.ok(push.prediction.apex<=2.3);
 const drop=shotVelocity({x:0,y:-4,z:2.8},{x:0,y:1.25},'drop');assert.ok(drop.vz<=0);assert.ok(drop.prediction.apex<=2.8);assert.ok(drop.prediction.netHeight>1.524);
});
