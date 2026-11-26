"""Read the 217-1 archives in place. Cache deterministic CPU pose estimates outside the served app."""
import argparse
import collections
import json
import random
import zipfile
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/dataset-study'
HOME = Path.home()
DATASET = '217-1.배드민턴 동작 및 경기영상 데이터'
TRAIN_DIR = HOME / 'Downloads' / DATASET
VAL_DIR = HOME / 'OneDrive/바탕 화면/개발/배드민턴 학습' / DATASET
HELD_DATE = '220804'
NAMES = 'shoulderL shoulderR elbowL elbowR wristL wristR hipL hipR kneeL kneeR ankleL ankleR heelL heelR toeL toeR earL earR handL handR nose'.split()
INDEX = [11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32,7,8,19,20,0]
LABELS = 'sdlf sdrt eblf ebrt wtlf wtrt hplf hprt knlf knrt aklf akrt'.split()


def identity(filename):
    tokens = Path(filename).stem.split('_')
    return '_'.join(tokens[:-1]), int(tokens[-1]), tokens[1]


def read_image(archive, member):
    img = cv2.imdecode(np.frombuffer(archive.read(member), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(member)
    return img


def roi(img, box):
    x,y,w,h = box
    r = max(w*.72,h*.68)
    cx,cy = x+w/2,y+h/2
    h,w = img.shape[:2]
    return [max(0,int(cx-r)),max(0,int(cy-r)),min(w,int(cx+r)),min(h,int(cy+r))]


def estimate(model,img,rect):
    x,y,b,r = rect
    if b-x < 32 or r-y < 32:
        return []
    crop = cv2.cvtColor(img[y:r,x:b],cv2.COLOR_BGR2RGB)
    result = model.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=crop))
    poses = []
    for coords,world in zip(result.pose_landmarks,result.pose_world_landmarks):
        uv = np.array([[coords[i].x*(b-x)+x, coords[i].y*(r-y)+y] for i in INDEX])
        xyz = np.array([[world[i].x,-world[i].y,-world[i].z] for i in INDEX])
        vis = np.array([coords[i].visibility for i in INDEX])
        if vis[:12].min()<.34 or np.mean(vis[:12])<.77:
            continue
        if not np.isfinite(xyz).all() or np.linalg.norm(xyz[6]-xyz[7])<.10:
            continue
        poses.append({'uv':uv.round(2).tolist(),'xyz':xyz.round(5).tolist(),'visibility':vis.round(4).tolist()})
    return poses


def get_labels(label_zip):
    labels = {}
    with zipfile.ZipFile(label_zip) as z:
        for name in z.namelist():
            d = json.loads(z.read(name))
            annotations = d['learningDataInfo']['annotations']
            players = [a for a in annotations if a['class']=='player' and 'keypoint' in a]
            labels[Path(name).stem] = players
    return labels


def choose(records,n,seed):
    records=sorted(records)
    if n is None or n>=len(records):return records
    return sorted(random.Random(seed).sample(records,min(n,len(records))))


def run(train_dir,val_dir,model_path,train_n,test_n,resume=False):
    CACHE.mkdir(exist_ok=True,parents=True)
    sources=sorted(train_dir.rglob('TS*.zip'))+sorted(val_dir.rglob('VS*.zip'))
    label_files=sorted(val_dir.rglob('VL*.zip'))
    if len(sources)!=11 or len(label_files)!=2:
        raise RuntimeError(f'Expected 11 source ZIPs and 2 label ZIPs, got {len(sources)} and {len(label_files)}')
    labels={p.name.split('_')[-2]:get_labels(p) for p in label_files}
    metadata={'archives':{},'holdoutDate':HELD_DATE,'names':NAMES,'labelFiles':{p.name:len(labels[p.name.split('_')[-2]]) for p in label_files}}
    pose_options=vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_buffer=model_path.read_bytes()),num_poses=1,min_pose_detection_confidence=.40)
    partial=CACHE/'samples.jsonl';cutoff={};prior=collections.Counter()
    if resume and partial.exists():
        # An interruption can leave the final person's record or the final image incomplete.
        old=[json.loads(l) for l in partial.read_text().splitlines() if l.endswith('}')]
        if old:
            last=(old[-1]['source'],old[-1]['member'])
            old=[r for r in old if (r['source'],r['member'])!=last]
            for r in old:
                cutoff[r['source']]=r['member'];prior[r['source']]+=1
            tmp=partial.with_suffix('.resume')
            tmp.write_text(''.join(json.dumps(r,separators=(',',':'))+'\n' for r in old),encoding='utf8')
            tmp.replace(partial)
    with vision.PoseLandmarker.create_from_options(pose_options) as model, partial.open('a' if cutoff else 'w',encoding='utf8') as out:
        for file in sources:
            parts=file.stem.split('_');match_type=parts[-2]; label=labels[match_type]
            cp=parts[4]=='CP';train=parts[0]=='TS'
            neighbors=collections.defaultdict(list)
            for key in label:
                segment,number,date=identity(key)
                if date!=HELD_DATE:neighbors[segment].append((number,key))
            with zipfile.ZipFile(file) as archive:
                names=sorted(archive.namelist()); counts={'members':len(names),'imagesRead':0,'roiAttempts':0,'retained':0}
                eligible=[]
                for name in names:
                    seg,number,date=identity(name)
                    if train:
                        if date==HELD_DATE or not neighbors[seg]:continue
                        dist,nearest=min((abs(n-number),k) for n,k in neighbors[seg])
                        if dist<=8:eligible.append((name,nearest))
                    elif cp:
                        if date==HELD_DATE and Path(name).stem in label:eligible.append((name,Path(name).stem))
                    else:eligible.append((name,''))
                sample=choose(eligible,train_n if train else test_n if cp else 16,42+len(metadata['archives']))
                counts['retained']=prior[file.name]
                for name,neighbor in sample:
                    counts['imagesRead']+=1
                    if name<=cutoff.get(file.name,''):
                        counts['roiAttempts']+=len(label[neighbor]) if neighbor else 2
                        continue
                    image=read_image(archive,name)
                    if neighbor:
                        players=label[neighbor]
                        boxes=[(roi(image,p['bbox']),p) for p in players]
                    else:
                        h,w=image.shape[:2]
                        boxes=[([int(w*x),int(.31*h),int(w*(x+.37)),int(.88*h)],None) for x in [.15,.46]]
                    used=[]
                    for rect,player in boxes:
                        counts['roiAttempts']+=1
                        for est in estimate(model,image,rect):
                            uv=np.array(est['uv']);hips=uv[6:8].mean(0)
                            if player:
                                bx,by,bw,bh=player['bbox']
                                if not (bx-.12*bw<hips[0]<bx+1.12*bw and by+.19*bh<hips[1]<by+.90*bh):continue
                            if any(np.linalg.norm(hips-other)<24 for other in used):continue
                            used.append(hips)
                            record={**est,'source':file.name,'member':name,'rect':rect,
                                'split':'train' if train else 'test' if cp else 'external'}
                            if player and not train:
                                record['gt']=[player['keypoint'][k] for k in LABELS]
                                record['bbox']=player['bbox']
                            out.write(json.dumps(record,separators=(',',':'))+'\n');counts['retained']+=1
                metadata['archives'][file.name]=counts
                print(file.name,counts,flush=True)
    (CACHE/'inventory.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf8')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--training',type=Path,default=TRAIN_DIR);parser.add_argument('--validation',type=Path,default=VAL_DIR)
    parser.add_argument('--landmarker',type=Path,default=ROOT/'.cache/pose/pose_landmarker.task')
    parser.add_argument('--train-per-archive',type=int);parser.add_argument('--test-per-archive',type=int)
    parser.add_argument('--resume',action='store_true')
    a=parser.parse_args();run(a.training,a.validation,a.landmarker,a.train_per_archive,a.test_per_archive,a.resume)

