import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,strokeTarget,serviceTarget,serviceLayout,shotVelocity} from '../physics.js';
import {solveTwoBone,buildPose} from '../motion.js';
const g=(dx,dy,speed=900,duration=.1)=>({dx,dy,speed,peak:speed,duration,distance:Math.hypot(dx,dy),power:.7});
test('diagonal down strokes stay attacks and distinguish jump drop',()=>{
 assert.equal(classify(g(-90,90),2.8,-4),'smash');
 assert.equal(classify(g(-20,25,120),2.8,-4),'drop');
 assert.equal(classify(g(-20,25,120,.7),2.8,-4,{highReturn:true}),'jumpDrop');
 assert.equal(classify(g(-60,90,900,.7),2.8,-4,{highReturn:true}),'jump');
});
test('course comes from drag vector relative to contact, straight down remains straight',()=>{
 const pos={x:.8,y:-4,z:2.8};
 assert.equal(strokeTarget(g(0,90),pos,'smash').x,.8);
 assert.ok(strokeTarget(g(-80,90),pos,'smash').x<.8);
 assert.ok(strokeTarget(g(80,90),pos,'smash').x>.8);
 assert.ok(strokeTarget(g(-80,90,120),pos,'drop').y<2);
});
test('service hold selects short/long and drag shifts within diagonal service court',()=>{
 for(const server of [0,1]){
 const layout=serviceLayout(server,0),short=serviceTarget(g(0,0,0,.1),layout),long=serviceTarget(g(0,0,0,.7),layout);
 assert.equal(short.type,'serveShort');assert.equal(long.type,'serveLong');
 assert.ok(Math.abs(short.y)<3);assert.ok(Math.abs(long.y)>5);
 const l=serviceTarget(g(-70,10),layout),r=serviceTarget(g(70,10),layout);assert.ok(l.x<r.x);
 for(const t of [short,long,l,r]){const v=shotVelocity({...layout.server,z:1.05},t,t.type);assert.ok(v.prediction.netHeight>1.524);assert.ok(Math.abs(v.prediction.y-t.y)<.35);}
 }
});
test('two bone IK maintains bone lengths for reachable targets',()=>{
 const root=[0,0,.9],target=[.3,.3,.1];const {joint,end}=solveTwoBone(root,target,.46,.46,[0,1,0]);
 const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 assert.ok(Math.abs(dist(root,joint)-.46)<1e-5);assert.ok(Math.abs(dist(joint,end)-.46)<1e-5);
});
test('pose has finite connected joints through running, lunge and overhead swing',()=>{
 for(const time of [0,.1,.3,.6,1]){
 const pose=buildPose({x:0,y:-3,vx:2,vy:3,side:-1,swing:.1,shotType:'smash',stepPhase:time*8},time,{charge:.7,jump:.3});
 for(const point of Object.values(pose.joints))assert.ok(point.every(Number.isFinite));
 assert.ok(pose.racket.tip.every(Number.isFinite));
 }
});
