import assert from 'node:assert/strict';
import { clips } from './clips.js';
import { evaluatePose, lengths } from './rig.js';
import { footworkClips } from '../footwork-clips.js';
import { prepareTrack, learnedPose, model } from './learned-rig.js';
import { samples as legacyExamples } from './learned-samples.js';
const learnedClips=legacyExamples.map(prepareTrack);

const samples = 601;
const pairs=[['hip','knee','thigh'],['knee','ankle','shin'],['shoulder','elbow','upperArm'],['elbow','wrist','forearm']];
let maxLengthError=0,maxContactSlip=0,minGround=Infinity,minCrossKnees=Infinity;
for(const clip of clips){
  let previous;
  for(let i=0;i<samples;i++){
    const p=evaluatePose(clip,i/(samples-1));
    for(const v of [...Object.values(p.j),p.center,p.racketDir])assert.ok(v.toArray().every(Number.isFinite),clip.id);
    for(const s of ['R','L']){
      const foot=p.feet[s];
      minGround=Math.min(minGround,foot.toe.y,foot.heel.y);
      if(foot.contact)assert.ok(Math.min(foot.toe.y,foot.heel.y)<1e-8,clip.id+' support height');
      if(previous?.feet[s].contact&&foot.contact){
        // At least one endpoint must stay pinned through heel/toe rolling.
        const prev=previous.feet[s];
        maxContactSlip=Math.max(maxContactSlip,Math.min(foot.toe.distanceTo(prev.toe),foot.heel.distanceTo(prev.heel)));
      }
      for(const [a,b,name] of pairs){
        maxLengthError=Math.max(maxLengthError,Math.abs(p.j[a+s].distanceTo(p.j[b+s])-lengths[name]));
      }
    }
    if(clip.id==='cross')minCrossKnees=Math.min(minCrossKnees,p.j.kneeR.distanceTo(p.j.kneeL));
    previous=p;
  }
  const first=evaluatePose(clip,0),last=evaluatePose(clip,1);
  for(const k of Object.keys(first.j))assert.ok(first.j[k].distanceTo(last.j[k])<1e-8,clip.id+' loop '+k);
}
assert.ok(maxLengthError<1e-8);
assert.ok(minGround>=-1e-8);
assert.ok(maxContactSlip<1e-8);
assert.ok(minCrossKnees>.18);
const at=(id,t)=>evaluatePose(clips.find(c=>c.id===id),t);
for(const s of ['R','L']){
  assert.ok(Math.abs(at('ready',0).angles['elbow'+s]-footworkClips[0].angles['elbow'+s])<.07);
}
const heelStrike=at('lunge',.40),loaded=at('lunge',.52);
assert.ok(heelStrike.feet.R.contact&&heelStrike.feet.R.toe.y>.05);
assert.ok(loaded.feet.R.toe.y<1e-8&&loaded.feet.L.heel.y>.08);
assert.ok(loaded.center.z<heelStrike.center.z&&loaded.center.y<heelStrike.center.y);
assert.ok(loaded.j.ankleR.z<loaded.j.ankleL.z-.8);
const crossed=at('cross',.50);
assert.ok(crossed.j.ankleL.x>crossed.j.ankleR.x&&crossed.j.ankleL.z<crossed.j.ankleR.z);
const cocked=at('overhead',.46),hit=at('overhead',.55);
assert.ok(hit.angles.elbowR>cocked.angles.elbowR+50);
assert.ok(hit.j.handR.y>hit.j.head.y+.30&&hit.racketDir.y>.65);
const air=at('smash',.53),land=at('smash',.67),absorb=at('smash',.75);
assert.ok(!air.feet.L.contact&&!air.feet.R.contact);
assert.ok(land.feet.L.contact&&!land.feet.R.contact&&absorb.feet.R.contact);
assert.ok(land.center.y>absorb.center.y&&land.angles.kneeL>absorb.angles.kneeL);
for(const clip of learnedClips){
  for(let i=0;i<samples;i++){
    const p=learnedPose(clip,i/(samples-1));
    for(const v of [...Object.values(p.j),p.center])assert.ok(v.toArray().every(Number.isFinite));
    for(const s of ['L','R']){
      assert.ok(Math.min(p.feet[s].toe.y,p.feet[s].heel.y)>-1e-8);
      for(const [a,b,name] of pairs)assert.ok(Math.abs(p.j[a+s].distanceTo(p.j[b+s])-model.lengths[name])<1e-8);
    }
  }
}
console.log('Learned image sequences verified at',learnedClips.length*samples,'sample times.');
console.log(JSON.stringify({clips:clips.length,frames:clips.length*samples,maxLengthErrorM:maxLengthError,maxContactSlipM:maxContactSlip,minGroundM:minGround,minCrossKneeDistanceM:minCrossKnees,lungeRightKnee:loaded.angles.kneeR,overheadElbow:[cocked.angles.elbowR,hit.angles.elbowR],landingLeftKnee:[land.angles.kneeL,absorb.angles.kneeL]},null,2));

