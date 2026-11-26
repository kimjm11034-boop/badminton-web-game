"""Group observed body poses and time-ordered movement independently of source shot labels."""
from collections import Counter
import hashlib
import json
from pathlib import Path

import numpy as np
from sklearn.cluster import MiniBatchKMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits
from catalog import OUT, save
from fit import design, features
from prepare import ROOT, HELD_DATE


def read_shard(path):
    return json.loads(path.read_text(encoding='utf8'))


def body(p):
    # Input is pelvis-centered, anatomical right/up/back, in normalized meters.
    def angle(a,b,c):
        x,y=p[:,a]-p[:,b],p[:,c]-p[:,b]
        return np.arccos(np.clip((x*y).sum(1)/np.maximum(1e-6,np.linalg.norm(x,axis=1)*np.linalg.norm(y,axis=1)),-1,1))/np.pi
    shoulders=p[:,:2].mean(1)
    wrist=p[:,4:6]-shoulders[:,None,:]
    knees=np.stack([angle(6,8,10),angle(7,9,11)],axis=1)
    elbows=np.stack([angle(0,2,4),angle(1,3,5)],axis=1)
    feet=p[:,10:12]
    return np.column_stack([wrist.reshape(len(p),6),knees,elbows,
                            np.linalg.norm(feet[:,1]-feet[:,0],axis=1),
                            feet[:,1,2]-feet[:,0,2],feet[:,1,1]-feet[:,0,1],
                            shoulders[:,2],-feet[:,:,1].min(1),
                            (p[:,2:4]-shoulders[:,None,:]).reshape(len(p),6)])


def describe(values,moving):
    v=values[:21];l,r=v[1],v[4]
    if max(l,r)>.025:arm=('오른팔' if r>l else '왼팔')+' 높이 든 자세'
    elif min(v[2],v[5])<-.29:arm=('왼팔' if v[2]<v[5] else '오른팔')+' 뻗은 자세'
    elif max(v[8:10])>.8:arm='편 팔꿈치'
    else:arm='굽힌 팔꿈치'
    if moving:
        delta=values[21:42]
        candidates=[(abs(delta[4]),'오른팔 '+('올리기' if delta[4]>0 else '내리기')),
                    (abs(delta[1]),'왼팔 '+('올리기' if delta[1]>0 else '내리기')),
                    (abs(delta[5]),'오른손 '+('앞으로' if delta[5]<0 else '뒤로')),
                    (abs(delta[2]),'왼손 '+('앞으로' if delta[2]<0 else '뒤로')),
                    (abs(delta[3]),'오른손 '+('바깥으로' if delta[3]>0 else '안으로')),
                    (abs(delta[0]),'왼손 '+('바깥으로' if delta[0]<0 else '안으로')),
                    (abs(delta[10]),'보폭 '+('넓히기' if delta[10]>0 else '좁히기')),
                    (abs(delta[7]),'오른무릎 '+('펴기' if delta[7]>0 else '굽히기')),
                    (abs(delta[6]),'왼무릎 '+('펴기' if delta[6]>0 else '굽히기'))]
        size,name=max(candidates)
        arm=name if size>.055 else '작은 자세 변화'
    leg='앞뒤로 벌린 발' if abs(v[11])>.30 else ('넓은 보폭' if v[10]>.49 else ('낮은 자세' if min(v[6:8])<.72 else '좁은 보폭'))
    return arm+' · '+leg


def collect():
    model=json.loads((ROOT/'motion-lab/learned-model.js').read_text(encoding='utf8').split(' = ',1)[1].strip().rstrip(';'))
    weights=np.array(model['weights']);anchors=np.array(model['anchors'])
    result={False:[],True:[]}
    manifest=read_shard(OUT/'manifest.json')
    parts=[]
    for group in manifest['groups']:
        for cam,stats in group['cameras'].items():
            count=stats['tracks']+stats['missing']
            parts.extend(OUT/f"{group['code']}-{cam}-{part}.json" for part in range((count+47)//48))
    for path in sorted(parts):
        code,variant,cam,part=path.stem.split('-');code+='-'+variant
        rows=read_shard(path)
        valid=[item for item in rows if not item['missing']]
        if not valid:continue
        fs=[f for row in valid for f in row['frames']]
        x=np.array([features(f['input']) for f in fs]);xyz=(design(x,anchors,model['gamma'])@weights+model['intercept']).reshape(-1,21,3)
        for i,f in enumerate(fs):
            if 'world' in f:xyz[i]=.2*xyz[i]+.8*np.array(f['world'])
        values=body(xyz);offset=0
        for i,row in enumerate(rows):
            if row['missing']:continue
            frames=row['frames'];n=len(frames);vals=values[offset:offset+n];offset+=n
            desc=vals.mean(0)
            if n>1:
                times=np.array([f['index'] for f in frames]);t=(times-times[0])/(times[-1]-times[0])
                mid=np.array([np.interp(.5,t,v) for v in vals.T])
                # Direction, halfway shape and excursion distinguish reversals and stroke phases.
                desc=np.r_[desc,vals[-1]-vals[0],mid-(vals[0]+vals[-1])/2,vals.max(0)-vals.min(0)]
            ref=[code,cam,int(part)*48+i,n,frames[0]['index'],frames[-1]['index'],row['id']]
            result[n>1].append((ref,desc,row['source'].split('_')[1]!=HELD_DATE))
    return result


def main():
    rng=np.random.default_rng(217)
    groups=[];quality={};by_camera={};neighbors={}
    for moving,rows in collect().items():
        raw=np.array([r[1] for r in rows]);fit=np.array([r[2] for r in rows])
        scaler=StandardScaler().fit(raw[fit])
        # Prevent low-variance landmark noise from dominating the Euclidean metric.
        x=np.clip((raw-scaler.mean_)/np.maximum(scaler.scale_,.055),-4,4)
        if moving:
            x[:,21:42]*=1.6;x[:,42:63]*=.55;x[:,63:]*=.85
        train=np.flatnonzero(fit);test=rng.choice(train,min(1800,len(train)),replace=False)
        scores=[];models=[]
        for k in [8,12,18,24,32]:
            km=MiniBatchKMeans(n_clusters=k,random_state=217,n_init=5,batch_size=768).fit(x[train])
            labels=km.predict(x[test])
            scores.append(silhouette_score(x[test],labels));models.append(km)
        # Choose the finest partition within 0.02 of the best separation.
        best=max(i for i,s in enumerate(scores) if s>=max(scores)-.02)
        km=models[best];lab=km.predict(x);family='motion' if moving else 'pose'
        held=np.flatnonzero(~fit)
        sample=rng.choice(held,min(1400,len(held)),replace=False) if len(held) else []
        quality[family]={'counts':[8,12,18,24,32],'silhouette':np.round(scores,4).tolist(),'selected':int(km.n_clusters),
                         'fittingTracks':int(fit.sum()),'assignedTracks':len(rows),
                         'holdoutSilhouette':round(silhouette_score(x[sample],lab[sample]),4) if len(set(lab[sample]))>1 else None}
        for ix in range(km.n_clusters):
            indices=np.flatnonzero(lab==ix)
            distances=np.linalg.norm(x[indices]-km.cluster_centers_[ix],axis=1)
            ids=indices[np.argsort(distances,kind='stable')]
            refs=[rows[i][0] for i in ids]
            gid=family+'-'+str(ix+1)
            save(gid+'-index',refs)
            for code,cam,index,*_ in refs:
                by_camera.setdefault(code+'-'+cam,{})[index]=gid
            # Retrieve specific examples by shape and direction within the learned group.
            # Omit different players cropped from the same original sequence.
            vectors=np.asarray(x[ids],dtype=np.float32);norm=np.sum(vectors*vectors,axis=1)
            segments=[r[6].rsplit('_',1)[0] for r in refs]
            for start in range(0,len(refs),128):
                distances=norm[None,:]-2*vectors[start:start+128]@vectors.T
                for j,d in enumerate(distances):
                    k=start+j;code,cam,index,*_=refs[k]
                    unique={segments[k]};near=[]
                    for m in np.argsort(d,kind='stable')[:80]:
                        if segments[m] not in unique:
                            unique.add(segments[m]);near.append(int(m))
                        if len(near)==8:break
                    neighbors.setdefault(code+'-'+cam,{})[index]=near
            summary=np.median(raw[ids[:min(60,len(ids))]],axis=0)
            code,cam,offset,*_=refs[0]
            example=read_shard(OUT/f'{code}-{cam}-{offset//48}.json')[offset%48]
            indices_to_show=sorted({0,len(example['frames'])//2,len(example['frames'])-1})
            previews=[{key:example['frames'][i][key] for key in ['index','input','world'] if key in example['frames'][i]} for i in indices_to_show]
            fingerprint=hashlib.sha256('\n'.join(sorted(r[6] for r in refs)).encode()).hexdigest()[:16]
            groups.append({'id':gid,'fingerprint':fingerprint,'name':describe(summary,moving),
                           'previewFrames':previews,
                           'kneeDegrees':int(round(180*min(summary[6:8]))),'footSpanCm':int(round(100*summary[10])),
                           'family':family,'count':len(refs),'cameras':dict(Counter(r[1] for r in refs)),
                           'codes':dict(Counter(r[0] for r in refs))})
    save('patterns',{'groups':groups,'quality':quality})
    for key,lookup in by_camera.items():
        size=len(read_shard(OUT/(key+'-index.json')))
        save(key+'-patterns',[lookup.get(i) for i in range(size)])
        save(key+'-similar',[neighbors[key].get(i,[]) for i in range(size)])
    print(quality,flush=True)


if __name__=='__main__':
    with threadpool_limits(limits=3):main()
