import test from 'node:test';
import assert from 'node:assert/strict';
import {integrate,trace,gestureMetrics,shotVelocity,groundWinner,matchWon,predictIntercept} from '../physics.js';

test('quadratic drag slows fast shots and terminal descent stays bounded',()=>{
 const b={x:0,y:0,z:20,vx:60,vy:0,vz:0};integrate(b);assert.ok(b.vx<60);
 const r=trace(b);assert.ok(r.vz>-7&&r.vz<0);assert.ok(r.x<20);
});
test('release velocity and drag distance are calculated in screen pixels',()=>{
 const g=gestureMetrics([{x:0,y:100,t:0},{x:0,y:50,t:50},{x:0,y:0,t:100}],.1);
 assert.equal(g.distance,100);assert.equal(g.speed,1000);assert.equal(g.dy,-100);
});
test('target solver clears net and lands inside for representative strokes',()=>{
 for(const [type,y,z,targetY] of [['clear',-4,2.7,5.5],['smash',-3,2.8,3],['jump',-3,3.7,3],['push',-1,1.8,4],['block',-4,.8,1.2],['drop',-3,2.8,1.2],['drive',-3,1.8,4],['lift',3.1,1.15,-4.2],['net',-1,1,1]]){
  const pos={x:0,y,z},v=shotVelocity(pos,{x:.7,y:targetY},type);
  assert.ok(v.prediction.netHeight>1.524,`${type} net: ${v.prediction.netHeight}`);
  assert.ok(Math.abs(v.prediction.y-targetY)<.35,`${type} target: ${v.prediction.y}`);
  assert.ok(Number.isFinite(v.speed));
 }
});
test('landing, out and deuce rules',()=>{
 assert.equal(groundWinner({x:0,y:-4},1),1);assert.equal(groundWinner({x:3,y:-4},1),0);
 assert.equal(matchWon([11,10],11),false);assert.equal(matchWon([12,10],11),true);assert.equal(matchWon([20,19],11),true);
});
test('prediction returns descending reachable-height point in receiving half',()=>{
 const p={x:0,y:3.1,z:1.15},v=shotVelocity(p,{x:0,y:-4.2},'lift');
 const target=predictIntercept({...p,...v},-1);assert.ok(target.y<0);assert.ok(target.z<=2.7);assert.ok(target.time>0);
});
