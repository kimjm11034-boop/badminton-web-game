"""Build short, single-player image sequences from held-out matches for the interactive lab."""
import base64
import collections
import json
import zipfile
from contextlib import ExitStack
from pathlib import Path

import cv2
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from prepare import ROOT, TRAIN_DIR, VAL_DIR, HELD_DATE, LABELS, identity, get_labels, read_image, estimate, roi
from fit import features, write_json_module


def label_points(player):
    return np.array([player['keypoint'][k] for k in LABELS])


def candidates(labels,members,tag):
    groups=collections.defaultdict(list)
    for name,players in labels.items():
        seg,n,date=identity(name)
        if date==HELD_DATE and tag in seg:groups[seg].append((n,players))
    tracks=[]
    for seg,entries in groups.items():
        if len(entries)<2:continue
        entries.sort()
        for first in entries[0][1]:
            if first['bbox'][3]<140:continue
            chain={entries[0][0]:first};last=first
            for n,players in entries[1:]:
                center=lambda p:label_points(p)[6:8,:2].mean(0)
                dist=lambda p:np.linalg.norm(center(p)-center(last))/max(1,last['bbox'][3])
                options=sorted(players,key=dist)
                if not options or dist(options[0])>.55 or (len(options)>1 and dist(options[1])-dist(options[0])<.28):break
                last=options[0];chain[n]=last
            if len(chain)!=len(entries):continue
            pts=np.array([label_points(p) for p in chain.values()])
            if (pts[:,:,2]==0).any() or (pts[:,:,2]==2).mean()<.86:continue
            near=[n for n in members[seg] if min(abs(n-i) for i in chain)<=6]
            motion=np.linalg.norm(features(pts[-1])-features(pts[0]))
            score=min(8,len(near))*.10+min(.8,motion)+len(chain)*.13+min(1,first['bbox'][3]/350)*.12
            tracks.append((score,seg,chain,near))
    return sorted(tracks,key=lambda c:-c[0])


def preview(img,rect,uv):
    x,y,b,r=rect;tile=img[y:r,x:b];height=170;width=max(1,round(height*tile.shape[1]/tile.shape[0]))
    tile=cv2.resize(tile,(width,height),interpolation=cv2.INTER_AREA)
    pt=np.round((np.array(uv)[:12,:2]-[x,y])*[width/(b-x),height/(r-y)]).astype(int)
    for i,j in [(0,1),(0,6),(1,7),(6,7),(0,2),(2,4),(1,3),(3,5),(6,8),(8,10),(7,9),(9,11)]:
        cv2.line(tile,tuple(pt[i]),tuple(pt[j]),(224,219,68) if i%2==0 else (42,147,255),1,cv2.LINE_AA)
    for a in pt:cv2.circle(tile,tuple(a),2,(245,245,249),-1,cv2.LINE_AA)
    return 'data:image/jpeg;base64,'+base64.b64encode(cv2.imencode('.jpg',tile,[cv2.IMWRITE_JPEG_QUALITY,85])[1]).decode()


def build():
    output=[]
    options=vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_buffer=(ROOT/'.cache/pose/pose_landmarker.task').read_bytes()),num_poses=1,min_pose_detection_confidence=.4)
    with vision.PoseLandmarker.create_from_options(options) as detector, ExitStack() as stack:
        labels={};members=collections.defaultdict(dict)
        for label_zip in VAL_DIR.rglob('VL*.zip'):
            labels.update(get_labels(label_zip))
        for f in sorted(TRAIN_DIR.rglob('TS*.zip'))+sorted(VAL_DIR.rglob('VS*CP*.zip')):
            z=stack.enter_context(zipfile.ZipFile(f))
            for name in z.namelist():
                seg,n,date=identity(name)
                if date==HELD_DATE:members[seg][n]=(z,name)
        for tag,title in [('SMS-','팔 올려 타격하기'),('HPN-','전방으로 팔 뻗기'),('DRV-','낮은 자세에서 반응하기')]:
            for _,seg,chain,numbers in candidates(labels,members,tag):
                frames=[]
                for n in sorted(numbers):
                    z,name=members[seg][n];img=read_image(z,name)
                    ref=chain[min(chain,key=lambda i:abs(i-n))];rect=roi(img,ref['bbox'])
                    if n in chain:
                        uv=label_points(chain[n])[:,:2];method='label'
                    else:
                        results=estimate(detector,img,rect)
                        if not results:continue
                        uv=np.array(results[0]['uv'])[:12];method='estimate'
                        delta=np.linalg.norm(uv[6:8].mean(0)-label_points(ref)[6:8,:2].mean(0))
                        if delta>ref['bbox'][3]*.42:continue
                    frames.append({'index':n,'member':Path(name).name,'archive':Path(z.filename).name,
                          'method':method,'rect':rect,'input':uv.round(2).tolist(),'image':preview(img,rect,uv)})
                if len(frames)>=4:
                    output.append({'id':'learn-'+tag[:3].lower(),'name':title,'source':seg,'frames':frames})
                    print(title,seg,[f['index'] for f in frames],flush=True);break
            else:raise ValueError('No usable track '+tag)
    write_json_module(ROOT/'motion-lab/learned-samples.js','samples',output)


if __name__=='__main__':build()

