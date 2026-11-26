import test from 'node:test';import assert from 'node:assert/strict';
import {classify,judgeTiming,predictContactTime,timingRadius} from '../physics.js';
const g=(length,speed=100)=>({dx:0,dy:length,distance:length,speed,peak:speed,duration:.7,power:.5});
test('short drag drops even fast, long drag smashes even slow',()=>{
 assert.equal(classify(g(30,2000),2.8,-4),'drop');assert.equal(classify(g(100,30),2.8,-4),'smash');
 assert.equal(classify(g(71),2.8,-4,{highReturn:true}),'jumpDrop');assert.equal(classify(g(72),2.8,-4,{highReturn:true}),'jump');
});
test('timing is advisory and circle alignment determines the grade',()=>{
 assert.equal(judgeTiming(.23,true),'GOOD');assert.equal(judgeTiming(0,true),'PERFECT');assert.equal(judgeTiming(.09,true),'GOOD');assert.equal(judgeTiming(.35,true),'BAD');assert.equal(judgeTiming(.8,false),'BAD');
 assert.ok(timingRadius(-.6)<timingRadius(-.2));assert.equal(timingRadius(0),20);assert.ok(timingRadius(.4)>20);
});
test('contact forecast finds descending point on receiver side',()=>{
 const t=predictContactTime({x:0,y:-2,z:3,vx:0,vy:0,vz:-2},-1);assert.ok(t>0&&t<1);
});
