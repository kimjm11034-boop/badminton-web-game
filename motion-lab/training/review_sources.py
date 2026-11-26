"""Build the read-only review inventory. Also serve one original JPEG from a supplied ZIP."""
from collections import defaultdict
from pathlib import Path
import hashlib
import json
import sqlite3
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / 'motion-lab'
CACHE = ROOT / '.cache/dataset-study'
NAME = '217-1.배드민턴 동작 및 경기영상 데이터'
TRAIN = Path.home() / 'Downloads' / NAME
VAL = Path.home() / 'OneDrive/바탕 화면/개발/배드민턴 학습' / NAME
KEYS = 'sdlf sdrt eblf ebrt wtlf wtrt hplf hprt knlf knrt aklf akrt head neck chst bely'.split()


def originals():
    return [*TRAIN.rglob('TS*.zip'), *VAL.rglob('VS*.zip')]


def encode(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def key(track, member):
    return hashlib.sha256((track+'|'+member).encode()).hexdigest()[:24]


def build():
    import numpy as np
    dest = LAB/'review'/'inventory.sqlite'
    dest.parent.mkdir(exist_ok=True)
    tmp = dest.with_suffix('.building')
    db = sqlite3.connect(tmp)
    db.executescript('''DROP TABLE IF EXISTS items;
      CREATE TABLE items(id TEXT UNIQUE NOT NULL,track TEXT,member TEXT,archive TEXT,zipkey TEXT,
      kind TEXT,method TEXT,points TEXT,flags TEXT,box TEXT,world TEXT);''')
    cat=LAB/'catalog'
    manifest=json.loads((cat/'manifest.json').read_bytes())
    found=defaultdict(list)
    for group in manifest['groups']:
        for cam,stats in group['cameras'].items():
            for i in range((stats['tracks']+stats['missing']+47)//48):
                for track in json.loads((cat/f"{group['code']}-{cam}-{i}.json").read_bytes()):
                    for f in track['frames']:
                        found[f['member']].append((track['id'],f.get('input'),f.get('method','missing'),f['rect'],f.get('world')))
    labels=defaultdict(list)
    for path in VAL.rglob('VL*.zip'):
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                obj=json.loads(z.read(n))
                for a in obj['learningDataInfo']['annotations']:
                    if a['class']=='player' and 'keypoint' in a:
                        labels[Path(n).stem+'.jpg'].append([a['keypoint'][k] for k in KEYS])
    for path in originals():
        with (CACHE/'all-frames'/(path.stem+'.jsonl')).open(encoding='utf8') as log:
            for line in log:
                r=json.loads(line); member=Path(r['member']).name
                candidates=r['people']; uv=np.array([c['uv'] for c in candidates])
                matched=set()
                def add(t,kind,method,points,flags,box,world=None):
                    db.execute('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                               (key(t,member),t,member,path.name,r['member'],kind,method,
                                encode(points),encode(flags),encode(box),encode(world)))
                def candidate_box(p):
                    lo,hi=p.min(0),p.max(0);h=max(15,hi[1]-lo[1])
                    a=np.maximum([0,0],lo-[h*.15,h*.30]);b=np.minimum([1920,1080],hi+[h*.15,h*.16])
                    return [*a.tolist(),*b.tolist()]
                for t,raw,method,box,world in found[member]:
                    if raw is None:
                        add(t,'missing',method,[None]*22,[],box);continue
                    p=np.array(raw);points=list(raw)+[None]*10;flags=set()
                    if len(candidates):
                        direct=np.linalg.norm(uv-p,axis=2).mean(1)
                        mirror=np.linalg.norm(uv[:,np.arange(12)^1]-p,axis=2).mean(1)
                        err=np.minimum(direct,mirror);idx=int(err.argmin());h=max(25,np.ptp(p[:,1]))
                        if err[idx]<h*.19:
                            matched.add(idx);conf=np.array(candidates[idx]['v'])
                            if mirror[idx]<direct[idx]:flags.update(range(12))
                            else:flags.update(int(j) for j in np.flatnonzero(conf<.72))
                            flags.update(int(j) for j in np.flatnonzero(np.linalg.norm(uv[idx]-p,axis=1)>h*.17))
                    if method=='label':
                        for l in labels[member]:
                            if np.max(np.abs(np.array(l)[:12,:2]-p))<1:
                                points[12:16]=[a[:2] if a[2]>0 else None for a in l[12:16]]
                                flags.update(i for i,a in enumerate(l) if a[2]<2);break
                    if np.ptp(p[:,1])<105:flags.update(range(12))
                    add(t,'uncertain' if flags else 'catalog',method,points,sorted(flags),box,world)
                for i,c in enumerate(candidates):
                    if i in matched:continue
                    p=np.array(c['uv'])
                    add('candidate-'+str(i)+'-'+Path(member).stem,'candidate','detector',
                        c['uv']+[None]*10,[j for j,v in enumerate(c['v']) if v<.72],candidate_box(p))
    db.executescript('CREATE INDEX review_kind ON items(kind);CREATE INDEX review_track ON items(track);CREATE INDEX review_member ON items(member);')
    print(db.execute('SELECT kind,count(*) FROM items GROUP BY kind').fetchall(),flush=True)
    assert db.execute('SELECT count(DISTINCT member) FROM items').fetchone()[0]==manifest['stats']['images']
    db.commit();db.close();tmp.replace(dest)


if __name__=='__main__':
    if len(sys.argv)==4 and sys.argv[1]=='photo':
        path=next(p for p in originals() if p.name==sys.argv[2])
        with zipfile.ZipFile(path) as z:sys.stdout.buffer.write(z.read(sys.argv[3]))
    elif len(sys.argv)==1:build()
    else:raise ValueError('Unexpected arguments')
