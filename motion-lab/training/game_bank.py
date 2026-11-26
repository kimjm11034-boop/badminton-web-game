"""Distill real player trajectories into phase-indexed motions for the match renderer."""
import collections
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.optimize import linear_sum_assignment

from fit import canon, pooled_records, upright, write_json_module
from prepare import CACHE, ROOT, NAMES, identity


def tracked_pairs(records,calib):
    groups=collections.defaultdict(lambda:collections.defaultdict(list))
    for r in records:
        if r['split']!='train' or not upright(r):continue
        seg,n,_=identity(r['member'])
        groups[seg][n].append(r)
    pairs=[];origins=[]
    for seg,frames in groups.items():
        prev=None
        for n,people in sorted(frames.items()):
            if prev and n-prev[0]<=16:
                before=prev[1]
                def cost(a,b):
                    x=np.asarray(a['uv'])[:12];y=np.asarray(b['uv'])[:12]
                    height=max(55,np.ptp(x[:,1]),np.ptp(y[:,1]))
                    return np.linalg.norm(x[6:8].mean(0)-y[6:8].mean(0))/height+.22*abs(np.log(max(1,np.ptp(x[:,1]))/max(1,np.ptp(y[:,1]))))
                costs=np.array([[cost(a,b) for b in people] for a in before])
                rows,cols=linear_sum_assignment(costs)
                for i,j in zip(rows,cols):
                    if costs[i,j]>.50:continue
                    alternatives=np.r_[np.delete(costs[i],j),np.delete(costs[:,j],i)]
                    if len(alternatives) and alternatives.min()<costs[i,j]+.12:continue
                    a,b=canon(before[i],calib),canon(people[j],calib)
                    if np.linalg.norm(a[:12]-b[:12],axis=1).mean()>.32:continue
                    pairs.append([a,b]);origins.append((seg,prev[0],n))
            prev=n,people
    return np.array(pairs),origins


def descriptor(p):
    norm=lambda v:v/np.maximum(1e-7,np.linalg.norm(v,axis=-1,keepdims=True))
    delta=lambda a,b:norm(p[...,b,:]-p[...,a,:])
    spine=norm(p[...,0:2,:].mean(-2)-p[...,6:8,:].mean(-2))
    axes=[spine,delta(0,1),delta(1,3),delta(3,5),delta(0,2),delta(2,4),
          delta(7,9),delta(9,11),delta(6,8),delta(8,10),delta(13,15),delta(12,14)]
    low=-np.minimum(p[...,10,1],p[...,11,1])
    wide=np.abs(p[...,10,0]-p[...,11,0])
    return np.concatenate([*axes,np.stack([low,wide],axis=-1)],axis=-1)


def guided_phases():
    js="""import {clips} from './motion-lab/clips.js';import {evaluatePose} from './motion-lab/rig.js';
    const out={};for(const c of clips){out[c.id]=Array.from({length:33},(_,i)=>{const p=evaluatePose(c,i/32),j=p.j;return Object.fromEntries(Object.entries(j).map(([k,v])=>[k,v.clone().sub(j.pelvis).toArray()]));});}console.log(JSON.stringify(out));"""
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=ROOT,encoding='utf8'))


def main():
    metadata=json.loads((ROOT/'motion-lab/training/results.json').read_text(encoding='utf8'))
    calib={s:np.deg2rad(v) for s,v in metadata['calibratedCameras'].items()}
    pair,origin=tracked_pairs(pooled_records(),calib)
    if len(pair)<25:raise ValueError('Insufficient within-athlete trajectories')
    a,b=descriptor(pair[:,0]),descriptor(pair[:,1])
    mid=(a+b)/2;velocity=b-a
    game={};sources={}
    for key,points in guided_phases().items():
        query=descriptor(np.array([[row.get(n,row['head']) for n in NAMES] for row in points]))
        w=np.repeat([.9,.4,1.5,1.65,.9,1.0,.75,.65,.75,.65,.18,.18],3)
        w=np.r_[w,2.8,1.2]
        if key in ['ready','shuffle','split','cross']:w[18:30]*=1.55
        phases=[];used=set()
        for i,q in enumerate(query):
            drift=query[min(i+2,len(query)-1)]-query[max(0,i-2)]
            distance=np.mean((mid-q)**2*w,axis=1)+.24*np.mean((velocity-drift)**2*w,axis=1)
            ordered=np.argsort(distance);idx=[];unique=set()
            for k in ordered:
                if origin[k][0] in unique:continue
                idx.append(k);unique.add(origin[k][0])
                if len(idx)==8:break
            used.update(origin[k] for k in idx)
            coeff=np.exp(-(distance[idx]-distance[idx[0]])/.023);coeff/=coeff.sum()
            evidence=np.average(mid[idx],axis=0,weights=coeff)
            phases.append(.85*evidence+.15*q)
        smoothed=np.array(phases);smoothed[1:-1]=.18*smoothed[:-2]+.64*smoothed[1:-1]+.18*smoothed[2:]
        if key in ['ready','shuffle','cross','split']:smoothed[-1]=smoothed[0]
        game[key]=smoothed.round(5).tolist();sources[key]=len(used)
    lengths=json.loads((ROOT/'motion-lab/learned-model.js').read_text(encoding='utf8').split(' = ',1)[1].strip().rstrip(';'))['lengths']
    output={'version':1,'lengths':lengths,'trainingPoses':metadata['trainPeople'],'trackedPairs':len(pair),'motions':game}
    write_json_module(ROOT/'data/player-motion-bank.js','motionBank',output)
    metadata['gameMotion']={'trackedPairs':len(pair),'sourceSegments':len(set(s[0] for s in origin)),'contributingWindowsByMotion':sources}
    (ROOT/'motion-lab/training/results.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf8')
    print(metadata['gameMotion'])


if __name__=='__main__':main()

