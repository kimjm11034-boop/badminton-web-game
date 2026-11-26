"""Fit a normalized 2-D -> hip-local 3-D pose regressor and evaluate entire held-out recordings."""
import collections
import json
import os
import zipfile
from pathlib import Path

import numpy as np
from sklearn.cluster import MiniBatchKMeans
from sklearn.linear_model import Ridge
from sklearn.metrics.pairwise import euclidean_distances
from threadpoolctl import threadpool_limits

from prepare import CACHE, HELD_DATE, NAMES, ROOT, VAL_DIR, LABELS, get_labels


def unit(v):
    return v/max(np.linalg.norm(v),1e-8)


def features(uv):
    p=np.array(uv,dtype=float)[:12,:2]
    # Projected skeleton lengths keep the features independent of image or bounding-box size.
    size=sum(np.linalg.norm(p[a]-p[b]) for a,b in [(0,6),(1,7),(6,8),(7,9),(8,10),(9,11)])/2
    return ((p-p[[6,7]].mean(0))/max(size,1)).ravel()


def learn_centerline():
    keys=['head','neck','chst','bely']
    xs=[];ys=[];test=[]
    for f in VAL_DIR.rglob('VL*.zip'):
        for member,players in get_labels(f).items():
            for player in players:
                kp=player['keypoint']
                limbs=np.array([kp[k] for k in LABELS]);body=np.array([kp[k] for k in keys])
                if (limbs[:,2]<1).any() or (body[:,2]!=2).any():continue
                uv=limbs[:,:2];origin=uv[6:8].mean(0)
                size=sum(np.linalg.norm(uv[a]-uv[b]) for a,b in [(0,6),(1,7),(6,8),(7,9),(8,10),(9,11)])/2
                if size<8:continue
                x=features(uv);y=((body[:,:2]-origin)/size).ravel()
                if member.split('_')[1]==HELD_DATE:test.append((x,y,size,player['bbox'][3]))
                else:xs.append(x);ys.append(y)
    reg=Ridge(alpha=.15).fit(xs,ys);d=[]
    for x,y,size,h in test:d.extend(np.linalg.norm((reg.predict(x[None])[0]-y).reshape(4,2),axis=1)*size/h)
    return {'keys':keys,'weights':numeric(reg.coef_.T),'intercept':numeric(reg.intercept_),'trainPeople':len(xs),
            'testPeople':len(test),'meanErrorBoxHeight':float(np.mean(d)),'pck10':float(np.mean(np.array(d)<.1))}


def pitches(val_dir):
    by_cam=collections.defaultdict(list)
    for f in val_dir.rglob('VL*.zip'):
        with zipfile.ZipFile(f) as z:
            for name in z.namelist():
                data=json.loads(z.read(name))
                ann=data['learningDataInfo']['annotations']
                poly=next((p['polygon'] for p in ann if p['class']=='court'),[])
                if len(poly)!=8:continue
                p=np.column_stack([np.array(poly).reshape(-1,2),np.ones(4)])
                vanish=lambda a,b,c,d:np.cross(np.cross(p[a],p[b]),np.cross(p[c],p[d]))
                v=vanish(0,1,3,2);w=vanish(0,3,1,2)
                if min(abs(v[2]),abs(w[2]))<1e-5:continue
                v=v[:2]/v[2];w=w[:2]/w[2];center=np.array([960,540])
                f2=-np.dot(v-center,w-center)
                if f2<=0:continue
                focal=np.sqrt(f2)
                if not 500<focal<6500 or abs(v[0]-w[0])<100:continue
                horizon=v[1]+(w[1]-v[1])*(960-v[0])/(w[0]-v[0])
                pitch=np.arctan2(540-horizon,focal)
                if 0<pitch<np.pi/3:by_cam[data['rawDataInfo']['rawDataId']].append(pitch)
    return {k:float(np.median(v)) for k,v in by_cam.items()}


def canon(record,calibration):
    p=np.array(record['xyz'])
    raw='_'.join(Path(record['member']).stem.split('_')[:6])
    alpha=calibration.get(raw,0)
    co,si=np.cos(alpha),np.sin(alpha)
    y,z=p[:,1].copy(),p[:,2].copy()
    p[:,1],p[:,2]=co*y+si*z,-si*y+co*z
    axis=p[7]-p[6];axis[1]=0;axis=unit(axis)
    up=np.array([0,1,0]);back=np.cross(axis,up)
    p=(p-p[[6,7]].mean(0))@np.column_stack([axis,up,back])
    length=lambda a,b:np.linalg.norm(p[a]-p[b])
    leg=(length(6,8)+length(8,10)+length(7,9)+length(9,11))/2
    return p*.875/max(.1,leg)


def design(x,anchors,gamma):
    return np.column_stack((x,np.exp(-gamma*euclidean_distances(x,anchors,squared=True))))


def predict(model,uv):
    x=np.array([features(uv)])
    v=design(x,np.array(model['anchors']),model['gamma'])
    return (v@np.array(model['weights'])+model['intercept']).reshape(-1,3)


def numeric(a):
    return np.asarray(a).round(7).tolist()


def upright(r):
    p=np.array(r['xyz'])
    return (p[:2,1].mean()-p[6:8,1].mean()>.16 and p[6:8,1].mean()-p[10:12,1].mean()>.21
            and np.linalg.norm((p[7]-p[6])[[0,2]])>.075)


def train_regressor(x,poses,augment):
    rng=np.random.default_rng(217)
    views=[x];targets=[poses]
    if augment:
        for _ in range(6):
            projection=[]
            for p in poses:
                yaw=rng.uniform(-np.pi,np.pi);tilt=rng.uniform(.04,.58)
                u=np.cos(yaw)*p[:,0]+np.sin(yaw)*p[:,2]
                depth=-np.sin(yaw)*p[:,0]+np.cos(yaw)*p[:,2]
                v=np.cos(tilt)*p[:,1]-np.sin(tilt)*depth
                uv=np.column_stack((u,-v))*450/(1-depth[:,None]/rng.uniform(5,12))
                uv+=rng.normal(0,3,uv.shape)
                projection.append(features(uv))
            views.append(np.asarray(projection));targets.append(poses)
    x=np.concatenate(views);y=np.concatenate(targets)
    anchors=MiniBatchKMeans(n_clusters=min(150,len(x)//4),n_init=4,batch_size=512,random_state=217).fit(x).cluster_centers_
    distances=euclidean_distances(x,anchors,squared=True)
    gamma=float(1/max(.01,np.median(np.partition(distances,5,axis=1)[:,5])))
    a=design(x,anchors,gamma)
    weights=np.ones(len(x));weights[:len(poses)]=3 if augment else 1
    estimator=Ridge(alpha=.25).fit(a,y.reshape(len(y),-1),sample_weight=weights)
    return {'version':1,'names':NAMES,'anchors':numeric(anchors),'gamma':gamma,
            'weights':numeric(estimator.coef_.T),'intercept':numeric(estimator.intercept_)}


def write_json_module(path,name,obj):
    path.write_text('export const '+name+' = '+json.dumps(obj,ensure_ascii=False,separators=(',',':'),allow_nan=False)+';\n',encoding='utf8')


def pooled_records():
    records=[json.loads(line) for line in (CACHE/'samples.jsonl').read_text().splitlines()]
    by_image=collections.defaultdict(list)
    for r in records:
        if r['split']=='train':by_image[r['member']].append(np.array(r['uv'])[6:8].mean(0))
    for line in (CACHE/'moving-pairs.jsonl').read_text().splitlines():
        r=json.loads(line);xy=np.array(r['uv'])[6:8].mean(0)
        if all(np.linalg.norm(xy-q)>25 for q in by_image[r['member']]):
            records.append(r);by_image[r['member']].append(xy)
    return records


def fit():
    records=pooled_records()
    train=[r for r in records if r['split']=='train' and upright(r)]
    test=[r for r in records if r['split']=='test']
    external=[r for r in records if r['split']=='external' and HELD_DATE in r['member']]
    match=lambda r:tuple(Path(r['member']).stem.split('_')[i] for i in [1,2,3,5])
    assert {match(r) for r in train}.isdisjoint({match(r) for r in test})
    assert len(train)>100 and len(test)>40
    calibration=pitches(VAL_DIR)
    x=np.array([features(r['uv']) for r in train]); poses=np.array([canon(r,calibration) for r in train])
    # RBF centres and all regression coefficients are fit using Training JPGs only.
    # Select augmentation on a whole Training recording, never on August 4.
    inner=np.array([match(r)[-1]=='18' for r in train]);validation={}
    for augmented in (False,True):
        trial=train_regressor(x[~inner],poses[~inner],augmented)
        guesses=np.array([predict(trial,r['uv']) for r,m in zip(train,inner) if m])
        validation[augmented]=float(np.linalg.norm(guesses[:,:12]-poses[inner,:12],axis=2).mean())
    augmented=min(validation,key=validation.get)
    model=train_regressor(x,poses,augmented)
    model['centerline']=learn_centerline()
    segments={'upperArm':[(0,2),(1,3)],'forearm':[(2,4),(3,5)],'thigh':[(6,8),(7,9)],'shin':[(8,10),(9,11)]}
    lengths={k:float(np.median([np.linalg.norm(poses[:,i]-poses[:,j],axis=1) for i,j in pairs])) for k,pairs in segments.items()}
    scale=.875/(lengths['thigh']+lengths['shin']);model['lengths']={k:round(v*scale,6) for k,v in lengths.items()}
    mean=poses.mean(0);errors=[];baseline=[];pck=[];leg_pck=[]
    for r in test:
        gt=np.array(r['gt']);vis=gt[:,2]==2
        err=np.linalg.norm(np.asarray(r['uv'])[:12]-gt[:,:2],axis=1)
        correct=err<=.10*r['bbox'][3]
        pck.extend(correct[vis]);leg_pck.extend(correct[8:][vis[8:]])
        if not (gt[:,2]>0).all() or not upright(r):continue
        pred=predict(model,gt);target=canon(r,calibration)
        e=np.linalg.norm(pred[:12]-target[:12],axis=1).mean()
        errors.append(e);baseline.append(np.linalg.norm(mean[:12]-target[:12],axis=1).mean())
    external_errors=[]
    for r in external:
        # These camera views lack court calibration and player labels. This is an agreement check only.
        external_errors.append(np.linalg.norm(predict(model,r['uv'])[:12]-canon(r,{})[:12],axis=1).mean())
    stats=json.loads((CACHE/'inventory.json').read_text(encoding='utf8'))
    stats.update({'trainPeople':len(train),'testPeople':len(test),'evaluated':len(errors),'innerValidationM':validation,'augmentation':augmented,'trainMatches':sorted({match(r) for r in train}),
      'testMatches':sorted({match(r) for r in test}),'pck10':float(np.mean(pck)),'pckJoints':len(pck),'legPck10':float(np.mean(leg_pck)),
      'pseudoErrorM':float(np.mean(errors)),'meanBaselineM':float(np.mean(baseline)),
      'externalPeople':len(external),'externalAgreementM':float(np.mean(external_errors)) if external_errors else None,
      'calibratedCameras':{k:round(float(np.rad2deg(v)),2) for k,v in calibration.items()}})
    model['stats']={k:stats[k] for k in ['trainPeople','testPeople','pseudoErrorM','meanBaselineM','pck10']}
    stats['pooledMotionWindows']=json.loads((CACHE/'movement-inventory.json').read_text(encoding='utf8'))
    stats['centerline']={k:v for k,v in model['centerline'].items() if k not in ['weights','intercept']}
    out=ROOT/'motion-lab';write_json_module(out/'learned-model.js','model',model)
    (out/'training/results.json').write_text(json.dumps(stats,indent=2,ensure_ascii=False),encoding='utf8')
    print(model['stats'],model['lengths'],flush=True)


if __name__=='__main__':
    with threadpool_limits(limits=2):fit()

