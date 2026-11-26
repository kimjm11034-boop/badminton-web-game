"""Run a multi-person keypoint detector on every original JPG. Completed ZIPs are resumable."""
import argparse
import json
import os
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/dataset-study'
if sys.version_info[:2] == (3, 12) and (CACHE / 'directml').exists():
    sys.path.insert(0, str(CACHE / 'directml'))
import cv2
import numpy as np
import onnxruntime as ort


def source_paths():
    dataset = '217-1.배드민턴 동작 및 경기영상 데이터'
    a = Path.home() / 'Downloads' / dataset
    b = Path.home() / 'OneDrive/바탕 화면/개발/배드민턴 학습' / dataset
    return sorted(a.rglob('TS*.zip')) + sorted(b.rglob('VS*.zip'))


def detect(session, img):
    h,w = img.shape[:2]
    scale = 640 / max(h,w)
    nw,nh = round(w*scale),round(h*scale)
    x,y = (640-nw)//2,(640-nh)//2
    image = np.full((640,640,3),114,np.uint8)
    image[y:y+nh,x:x+nw] = cv2.resize(img,(nw,nh))
    tensor = cv2.dnn.blobFromImage(image,1/255.,swapRB=True)
    pred = session.run(None, {'images':tensor})[0][0].T
    pred = pred[pred[:,4]>.23]
    if not len(pred):
        return []
    box = pred[:,:4].copy()
    box[:,:2] -= box[:,2:]*.5
    ids = cv2.dnn.NMSBoxes(box.tolist(),pred[:,4].tolist(),.23,.48)
    results = []
    for idx in np.asarray(ids).flatten():
        row = pred[idx]
        p = row[5:].reshape(17,3)[5:17].copy()
        # Decoding uses JPEG half-resolution, retain original-file pixel coordinates.
        p[:,:2] = (p[:,:2]-[x,y]) * (2/scale)
        if p[:,2].mean()<.64 or p[:,2].min()<.16 or np.ptp(p[:,1])<47:
            continue
        results.append({'uv':p[:,:2].round(1).tolist(),'v':p[:,2].round(3).tolist(),
                        'score':round(float(row[4]),3)})
    return results


def main(device):
    cv2.setNumThreads(1)
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 3
    opts.enable_mem_pattern = False
    providers = ([('DmlExecutionProvider',{'device_id':device})] if device is not None
                 and 'DmlExecutionProvider' in ort.get_available_providers() else []) + ['CPUExecutionProvider']
    session = ort.InferenceSession(str(ROOT / '.cache/pose/yolov8n-pose.onnx'),opts,providers=providers)
    outdir = CACHE/'all-frames'
    outdir.mkdir(exist_ok=True,parents=True)
    paths = source_paths()
    if len(paths)!=11:
        raise RuntimeError('Expected 11 original image archives')
    print(session.get_providers(),flush=True)
    for archive in paths:
        dest = outdir/(archive.stem+'.jsonl')
        if dest.exists():
            continue
        tmp = dest.with_suffix('.partial')
        seen = set()
        if tmp.exists():
            with tmp.open('rb+') as f:
                while line:=f.readline():
                    try:
                        seen.add(json.loads(line)['member'])
                    except ValueError:
                        f.seek(-len(line),os.SEEK_CUR); f.truncate(); break
        with zipfile.ZipFile(archive) as z, tmp.open('a',encoding='utf8') as out:
            for n,member in enumerate(sorted(z.namelist())):
                if member in seen:
                    continue
                img = cv2.imdecode(np.frombuffer(z.read(member),np.uint8),cv2.IMREAD_REDUCED_COLOR_2)
                if img is None:
                    raise ValueError(member)
                out.write(json.dumps({'member':member,'people':detect(session,img)},separators=(',',':'))+'\n')
                if n%250==0:
                    out.flush(); print(archive.stem,n,flush=True)
        tmp.replace(dest)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--device',type=str,default='0')
    main(parser.parse_args().device)
