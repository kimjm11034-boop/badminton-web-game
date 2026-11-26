"""Learn to reject spectators and officials using the provided player boxes."""
import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import precision_recall_fscore_support
from prepare import CACHE, HELD_DATE, VAL_DIR, get_labels


def descriptor(candidate,token):
    p=np.array(candidate['uv']);h=max(1,np.ptp(p[:,1]))
    hips=p[6:8].mean(0);ankles=p[10:12].mean(0);shoulders=p[:2].mean(0)
    raw=[hips[0]/1920,hips[1]/1080,ankles[0]/1920,ankles[1]/1080,h/1080,
         candidate['score'],np.mean(candidate['v']),np.min(candidate['v']),(ankles[1]-hips[1])/h,
         np.linalg.norm(p[10]-p[11])/h,(hips[1]-shoulders[1])/h,np.ptp(p[:,0])/h]
    return [*raw,*((p-hips)/h).ravel(),*[float(token[4]==f'R{i}') for i in range(1,9)]]


def official_boxes():
    boxes={}
    for path in VAL_DIR.rglob('VL*.zip'):
        boxes.update({stem:[p['bbox'] for p in players] for stem,players in get_labels(path).items()})
    return boxes


def same_box(candidate,boxes):
    p=np.array(candidate['uv']);hip=p[6:8].mean(0);height=max(1,np.ptp(p[:,1]))
    for x,y,w,h in boxes:
        if (x-.12*w<hip[0]<x+1.12*w and y+.15*h<hip[1]<y+.91*h and .45*h<height<1.35*h
            and x-.40*w<p[0:2,0].mean()<x+1.40*w):
            return True
    return False


def train_filter(boxes):
    features=[];truth=[];held=[]
    for source in sorted((CACHE/'all-frames').glob('VS*CP*.jsonl')):
        with source.open(encoding='utf8') as f:
            for line in f:
                frame=json.loads(line);stem=Path(frame['member']).stem;t=stem.split('_')
                if stem not in boxes:continue
                for c in frame['people']:
                    features.append(descriptor(c,t));truth.append(same_box(c,boxes[stem]));held.append(t[1]==HELD_DATE)
    x=np.asarray(features);y=np.array(truth);fit=~np.array(held)
    clf=HistGradientBoostingClassifier(max_iter=90,max_leaf_nodes=15,l2_regularization=2,random_state=217).fit(x[fit],y[fit])
    pred=clf.predict_proba(x[~fit])[:,1]>.30
    prec,rec,f,_=precision_recall_fscore_support(y[~fit],pred,average='binary')
    return clf,{'fitCandidates':int(fit.sum()),'holdoutCandidates':int((~fit).sum()),
                'precision':round(prec,4),'recall':round(rec,4),'f1':round(f,4),'holdoutDate':HELD_DATE}
