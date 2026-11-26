import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPose,updateMotion} from '../motion.js';
import {motionBank} from '../data/player-motion-bank.js';

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const base=side=>({x:0,y:3*side,side,vx:0,vy:0,swing:-10});

test('pooled body trajectories animate both world orientations',()=>{
  assert.ok(motionBank.trackedPairs>0);
  const [near,far]=[-1,1].map(side=>buildPose(base(side),2));
  for(const key of Object.keys(near.joints)){
    const [x,y,z]=near.joints[key];
    assert.ok(distance(far.joints[key],[-x,-y,z])<1e-6,key);
  }
  const moving={...base(-1),vx:3.2,vy:1};
  updateMotion(moving,1/60,2);
  const stride=buildPose(moving,2);
  assert.equal(stride.source,'pooled-player-motion');
  assert.ok(distance(near.joints.wristL,stride.joints.wristL)>.015);
});

test('grounded feet stay fixed through acceleration, deceleration and reversal',()=>{
  for(const side of [-1,1]){
    const p=base(side);let prev;
    for(let i=0;i<1200;i++){
      const t=i/240;p.vx=5*Math.sin(t*2);p.vy=3*Math.cos(t*2);p.x+=p.vx/240;p.y+=p.vy/240;
      updateMotion(p,1/240,t);
      const {rig}=buildPose(p,t),j=rig.j;
      assert.ok(j.pelvis.y>.68);
      if(prev)assert.ok(j.pelvis.distanceTo(prev.j.pelvis)<.048,'continuous weight transfer');
      for(const s of ['L','R']){
        const f=rig.feet[s];assert.ok(Math.min(f.toe.y,f.heel.y)>-1e-9);
        assert.ok(f.ankle.distanceTo(j['ankle'+s])<1e-6);
        for(const [a,b,k] of [['hip','knee','thigh'],['knee','ankle','shin'],['shoulder','elbow','upperArm'],['elbow','wrist','forearm']]){
          assert.ok(Math.abs(j[a+s].distanceTo(j[b+s])-motionBank.lengths[k])<1e-7);
        }
        if(prev?.feet[s].contact&&f.contact)assert.ok(f.sole.distanceTo(prev.feet[s].sole)<1e-9);
      }
      prev=rig;
    }
  }
});

test('a reachable shuttle meets the string bed at the strike instant',()=>{
  for(const side of [-1,1])for(const [shotType,x,y,z] of [['smash',.31,-2.7,2.10],['drive',.46,-2.52,1.36],['lift',.33,-2.68,.83]]){
    const f=-side,p={...base(side),shotType,swing:3,contactPoint:{x:x*f,y:y*f,z}};
    const hit=buildPose(p,3);
    assert.ok(distance(hit.racket.base,[x*f,y*f,z])<.001,shotType);
    const jump=buildPose(p,3.15,{jump:.32});
    assert.ok(!jump.rig.feet.R.contact&&!jump.rig.feet.L.contact);
  }
});

