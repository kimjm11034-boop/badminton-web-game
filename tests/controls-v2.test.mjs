import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,serviceLayout,validServiceLanding} from '../physics.js';
const g=(dx,dy,speed=800,duration=.1)=>({dx,dy,speed,peak:speed,distance:Math.hypot(dx,dy),duration,power:.8});
test('overhead controls follow attack down / defence up mapping',()=>{
 assert.equal(classify(g(0,90),2.7,-4),'smash');
 assert.equal(classify(g(0,30,120),2.7,-4),'drop');
 assert.equal(classify(g(0,-90),2.7,-4),'clear');
 assert.equal(classify(g(0,0,0),2,-4),'drive');
 assert.equal(classify(g(0,90,900,.7),2.9,-4,{highReturn:true}),'jump');
 assert.equal(classify(g(0,90,900,.7),2.9,-4,{highReturn:false}),'smash');
});
test('front court and defence are contextual',()=>{
 assert.equal(classify(g(-80,0),1.2,-1),'net');
 assert.equal(classify(g(0,-70),1.2,-1),'lift');
 assert.equal(classify(g(0,70),1.8,-1),'push');
 assert.equal(classify(g(0,0,0),1.8,-1),'drive');
 assert.equal(classify(g(0,-70),.8,-4,{defending:true}),'lift');
 assert.equal(classify(g(-70,-65),.8,-4,{defending:true}),'drive');
 assert.equal(classify(g(0,0,0),.8,-4,{defending:true}),'block');
});
test('server parity uses own view and diagonal receiving court',()=>{
 for(const server of [0,1])for(const points of [0,1,2,7]){
 const s=serviceLayout(server,points),ownSide=server===0?-1:1;
 assert.equal(Math.sign(s.server.x),(points%2?-1:1)*-ownSide);
 assert.equal(Math.sign(s.receiver.x),-Math.sign(s.server.x));
 assert.ok(validServiceLanding({x:s.receiver.x,y:s.receiver.y},s));
 assert.equal(validServiceLanding({x:s.server.x,y:s.receiver.y},s),false);
 assert.equal(validServiceLanding({x:s.receiver.x,y:ownSide*-1},s),false);
 }
});
