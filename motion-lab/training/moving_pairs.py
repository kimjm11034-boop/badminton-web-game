"""Read all fitting-date JPGs. Locate motion in neighboring frames before expensive person inference."""
import collections
import json
import zipfile
from pathlib import Path

import cv2
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from prepare import CACHE, HELD_DATE, ROOT, TRAIN_DIR, VAL_DIR, estimate, identity, read_image


def select_window(a,b):
    # Small camera shake affects most pixels. High-pass change and connected moving patches
    # localize the moving limb or torso; pose inference subsequently verifies the person.
    diff=cv2.absdiff(a,b).max(2)
    mask=(diff>max(21,np.percentile(diff,82))).astype('uint8')
    h,w=mask.shape
    mask[:int(h*.30)]=0;mask[int(h*.91):]=0
    mask[:,:int(w*.08)]=0;mask[:,int(w*.92):]=0
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    best=None
    for contour in contours:
        x,y,cw,ch=cv2.boundingRect(contour);area=cv2.contourArea(contour)
        if not 5<ch<h*.46 or not 4<cw<w*.28 or area<24:continue
        cx=x+cw/2;cy=y+ch/2
        side=np.clip(max(cw*1.8,ch*1.65,h*.23),h*.23,h*.60)
        score=area**.6*(.55+ch/(ch+cw))*(1-.45*abs(cx/w-.5))
        box=[int(4*max(0,cx-side/2)),int(4*max(0,cy-side*.54)),int(4*min(w,cx+side/2)),int(4*min(h,cy+side*.46))]
        if best is None or score>best[0]:best=(score,box)
    return best


def main():
    cv2.setNumThreads(2)
    src=sorted(TRAIN_DIR.rglob('TS*.zip'))+sorted(VAL_DIR.rglob('VS*.zip'))
    modelpath=ROOT/'.cache/pose/pose_landmarker.task'
    opts=vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_buffer=modelpath.read_bytes()),num_poses=1,min_pose_detection_confidence=.43)
    stats={}
    with vision.PoseLandmarker.create_from_options(opts) as model,(CACHE/'moving-pairs.jsonl').open('w',encoding='utf8') as out:
        for file in src:
            buckets=collections.defaultdict(list);groups=collections.defaultdict(list)
            with zipfile.ZipFile(file) as archive:
                for member in archive.namelist():
                    seg,n,date=identity(member)
                    if date!=HELD_DATE:groups[seg].append((n,member))
                scanned=0;kept=0;attempted=0
                for seg,group in sorted(groups.items()):
                    previous=None;best=None
                    for n,member in sorted(group):
                        small=cv2.imdecode(np.frombuffer(archive.read(member),np.uint8),cv2.IMREAD_REDUCED_COLOR_4)
                        scanned+=1
                        if previous and n-previous[0]<=16:
                            candidate=select_window(previous[2],small)
                            if candidate and (best is None or candidate[0]>best[0]):
                                best=(candidate[0],candidate[1],previous[1],member)
                        previous=(n,member,small)
                    if best:buckets['_'.join(seg.split('_')[:6])].append(best)
                for camera,windows in sorted(buckets.items()):
                    windows.sort(key=lambda v:-v[0])
                    # One observation per segment; spread the compute over every available camera.
                    limit=min(len(windows),max(8,round(100/max(1,len(buckets)))))
                    selected=np.linspace(0,max(0,int((len(windows)-1)*.84)),limit,dtype=int)
                    for wi in np.unique(selected):
                        _,box,a,b=windows[wi];attempted+=1;pair=[]
                        for name in [a,b]:
                            img=read_image(archive,name);results=estimate(model,img,box)
                            if not results:break
                            r=results[0];p=np.array(r['xyz'])
                            if p[:2,1].mean()-p[6:8,1].mean()<.16:break
                            pair.append({**r,'source':file.name,'member':name,'rect':box,'split':'train','origin':'motion-window'})
                        if len(pair)!=2:continue
                        q0,q1=(np.array(r['uv']) for r in pair)
                        size=np.ptp(q0[:12,1])
                        if size<60 or np.linalg.norm(q0[6:8].mean(0)-q1[6:8].mean(0))>size*.48:continue
                        for r in pair:out.write(json.dumps(r,separators=(',',':'))+'\n')
                        kept+=1
                stats[file.name]={'fittingDateImagesScanned':scanned,'candidateSegments':sum(map(len,buckets.values())),'pairAttempts':attempted,'acceptedPairs':kept}
                out.flush();print(file.name,stats[file.name],flush=True)
    (CACHE/'movement-inventory.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf8')


if __name__=='__main__':main()

