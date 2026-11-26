"""Index every source frame and assemble camera-local, same-person motion segments."""
import base64
from collections import Counter, defaultdict
from contextlib import ExitStack
import json
from pathlib import Path
import zipfile

import cv2
import numpy as np
from scipy.optimize import linear_sum_assignment
from catalog_inputs import archives, records, official, tokens
from prepare import CACHE, ROOT, VAL_DIR, estimate, read_image, roi
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from fit import canon
from player_filter import official_boxes,train_filter,descriptor,same_box

OUT = ROOT / 'motion-lab/catalog'
NAMES = {
    'SRV-BSS':'백핸드 쇼트 서브','SRV-FSS':'포핸드 쇼트 서브','SRV-BLH':'백핸드 롱 서브',
    'SRV-BDN':'백핸드 서브 · BDN','CLR-HIC':'하이 클리어','CLR-DNC':'드리븐 클리어',
    'CLR-UDC':'언더 클리어','HPN-FHP':'포핸드 헤어핀','HPN-BHP':'백핸드 헤어핀',
    'DRV-FDV':'포핸드 드라이브','DRV-BDV':'백핸드 드라이브','PSH-FPS':'포핸드 푸시',
    'PSH-BPS':'백핸드 푸시','DRP-FDR':'포핸드 드롭','DRP-BDR':'백핸드 드롭',
    'CUT-FCU':'포핸드 커트','CUT-BCU':'백핸드 커트','SMS-FSM':'포핸드 스매시',
    'SMS-BSM':'백핸드 스매시','UNI-UNI':'기타 장면 · UNI'}


def save(name, obj):
    dest=OUT/(name+'.json')
    tmp=dest.with_suffix('.tmp')
    tmp.write_text(json.dumps(obj,separators=(',',':'),ensure_ascii=False,allow_nan=False),encoding='utf8')
    tmp.replace(dest)


def sample(points, method, confidence=1.0, world=None):
    p=np.asarray(points,dtype=float)[:12,:2]
    return dict(p=p,hip=p[6:8].mean(0),h=max(1,np.ptp(p[:,1])),method=method,
                confidence=confidence,world=world)


def appearance(image,p):
    # The crop and pose coordinates retain the original image coordinate system.
    h,w=image.shape[:2]
    if p is None:
        rect=[0,0,w*2,h*2]; tile=cv2.resize(image,(256,round(256*h/w)))
    else:
        a,b=p.min(0),p.max(0)
        top=a[1]-(b[1]-a[1])*.26
        bottom=b[1]+(b[1]-a[1])*.12
        cx=(a[0]+b[0])/2
        half=max((b[0]-a[0])*.61,(bottom-top)*.40)
        x=max(0,int((cx-half)/2)); right=min(w,int(np.ceil((cx+half)/2)))
        y=max(0,int(top/2)); end=min(h,int(np.ceil(bottom/2)))
        rect=[2*x,2*y,2*right,2*end]
        crop=image[y:end,x:right]
        tile=cv2.resize(crop,(max(1,round(144*crop.shape[1]/crop.shape[0])),144))
    ok,encoded=cv2.imencode('.webp',tile,[cv2.IMWRITE_WEBP_QUALITY,68])
    if not ok: raise ValueError('Failed to encode source crop')
    return rect,'data:image/webp;base64,'+base64.b64encode(encoded).decode()


def read_sources(zips):
    source={}
    groups=defaultdict(list)
    for archive,z in zips.items():
        for member in z.namelist():
            stem=Path(member).stem
            if stem in source:raise ValueError('Duplicate source '+stem)
            source[stem]=(archive,member)
            groups[stem.rsplit('_',1)[0]].append(stem)
    if set(s.split('_')[8] for s in source)!=set(NAMES):
        raise ValueError('Review newly supplied source codes')
    return source,groups


def add_person(people,candidate):
    for p in people:
        size=max(45,min(p['h'],candidate['h']))
        distance=np.linalg.norm(p['hip']-candidate['hip'])
        if distance>=size*.25:continue
        direct=np.median(np.linalg.norm(p['p']-candidate['p'],axis=1))
        # One detector can reverse anatomical sides. Keep the higher-priority source
        # and its handedness when both observations describe the same visible athlete.
        swapped=candidate['p'].reshape(6,2,2)[:,::-1].reshape(12,2)
        reversed_error=np.median(np.linalg.norm(p['p']-swapped,axis=1))
        if direct<size*.32 or (distance<size*.13 and reversed_error<size*.18):
            if p['world'] is None and direct<=reversed_error: p['world']=candidate['world']
            return
    people.append(candidate)


def read_people(source):
    people=defaultdict(list)
    boxes=official_boxes()
    clf,metrics=train_filter(boxes)
    print('Player filter',metrics,flush=True)
    for stem,p,_ in official():
        if stem in source: add_person(people[stem],sample(p,'label'))
    calibration=json.loads((ROOT/'motion-lab/training/results.json').read_text(encoding='utf8'))['calibratedCameras']
    calibration={k:np.deg2rad(v) for k,v in calibration.items()}
    for r in records(extra=True):
        stem=Path(r['member']).stem
        add_person(people[stem],sample(r['uv'],'estimate',np.mean(r['visibility'][:12]),canon(r,calibration).round(4).tolist()))
    polygons={}
    for path in VAL_DIR.rglob('VL*.zip'):
        with zipfile.ZipFile(path) as z:
            for name in z.namelist():
                data=json.loads(z.read(name)); raw=data['rawDataInfo']['rawDataId']
                if raw not in polygons:
                    poly=next((p['polygon'] for p in data['learningDataInfo']['annotations'] if p['class']=='court' and len(p.get('polygon',[]))==8),None)
                    if poly:polygons[raw]=np.array(poly,np.float32).reshape(-1,2)
    seen=set()
    for path in archives():
        frames=[]
        with (CACHE/'all-frames'/(path.stem+'.jsonl')).open(encoding='utf8') as f:
            for line in f:
                datum=json.loads(line);stem=Path(datum['member']).stem;seen.add(stem);frames.append((stem,datum['people']))
        x=[descriptor(q,tokens(stem)) for stem,qs in frames for q in qs]
        prob=iter(clf.predict_proba(x)[:,1] if x else [])
        for stem,qs in frames:
                t=tokens(stem);poly=polygons.get('_'.join(t[:6]))
                ranked=sorted([(float(next(prob)),q) for q in qs],key=lambda v:-v[0])
                known=boxes.get(stem)
                # Visible competitors may leave the frame. The scene metadata supplies
                # only an upper bound in matches and is never a motion class.
                capacity=(4 if t[3]=='MD' else 2) if t[2] in ('CP','CU','EP','EU') else 4
                for chance,q in ranked:
                    if known is not None and not same_box(q,known):continue
                    if known is None and chance<.30:continue
                    s=sample(q['uv'],'detector',float(np.mean(q['v'])))
                    foot=s['p'][10:12].mean(0)
                    if s['h'] < 55 or not 24<foot[0]<1896 or not 190<foot[1]<1075:continue
                    if poly is not None and cv2.pointPolygonTest(poly,tuple(foot),True)<-max(75,s['h']*.8):continue
                    # The hip/ankle vertical separation excludes seated spectators.
                    if (foot[1]-s['hip'][1]) < s['h']*.24:continue
                    if known is not None or len(people[stem])<capacity:add_person(people[stem],s)
    if seen!=source.keys():raise ValueError('Every original frame needs a detector result')
    return people,metrics


def link_frames(stems,people):
    tracks=[];active=[]
    for stem in sorted(stems,key=lambda k:int(k.rsplit('_',1)[1])):
        n=int(stem.rsplit('_',1)[1])
        frame=sorted(people[stem],key=lambda p:tuple(p['hip']))
        before=[t for t in active if n-t[-1][0]<=16]
        assignment={}
        if frame and before:
            costs=[]
            for track in before:
                a=track[-1][2]
                row=[]
                for b in frame:
                    size=max(a['h'],b['h'])
                    row.append(np.linalg.norm(a['hip']-b['hip'])/size+
                               .20*abs(np.log(a['h']/b['h']))+
                               .15*np.median(np.linalg.norm((a['p']-a['hip'])-(b['p']-b['hip']),axis=1))/size)
                costs.append(row)
            costs=np.array(costs)
            rows,cols=linear_sum_assignment(costs)
            for i,j in zip(rows,cols):
                rivals=np.r_[np.delete(costs[i],j),np.delete(costs[:,j],i)]
                if costs[i,j]<.48 and (not len(rivals) or costs[i,j]+.10<min(rivals)):
                    assignment[j]=before[i]
        active=[]
        for i,p in enumerate(frame):
            track=assignment.get(i)
            if track is None:track=[];tracks.append(track)
            track.append((n,stem,p));active.append(track)
        if not frame:tracks.append([(n,stem,None)])
    return tracks


def recover_empty(source,groups,people,zips):
    """Reinspect empty frames at person scale using nearby observations in the same shot."""
    calibration=json.loads((ROOT/'motion-lab/training/results.json').read_text(encoding='utf8'))['calibratedCameras']
    calibration={k:np.deg2rad(v) for k,v in calibration.items()}
    opts=vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_buffer=(ROOT/'.cache/pose/pose_landmarker.task').read_bytes()),
                                      num_poses=2,min_pose_detection_confidence=.4)
    attempted=recovered=0
    with vision.PoseLandmarker.create_from_options(opts) as model:
        for stems in groups.values():
            anchors=[s for s in stems if people[s]]
            for stem in stems:
                if people[stem]:continue
                attempted+=1;n=int(stem.rsplit('_',1)[1]);archive,member=source[stem]
                image=read_image(zips[archive],member);h,w=image.shape[:2]
                nearby=sorted(anchors,key=lambda s:abs(int(s.rsplit('_',1)[1])-n))
                rects=[]
                if nearby and abs(int(nearby[0].rsplit('_',1)[1])-n)<=16:
                    for a in people[nearby[0]]:
                        x,y=a['hip'];size=a['h']
                        rects.append((roi(image,[x-size*.5,y-size*.65,size,size*1.32]),(x,y,size)))
                if not rects:
                    # Search the playing area at two scales when a recording has no nearby person.
                    rects=[([int(w*x),int(h*y),int(w*b),int(h*r)],None)
                           for x,y,b,r in [(.10,.18,.90,.96),(.09,.23,.57,.93),(.43,.23,.91,.93)]]
                for rect,prior in rects:
                    for q in estimate(model,image,rect):
                        s=sample(q['uv'],'estimate',np.mean(q['visibility'][:12]),canon({**q,'member':member},calibration).round(4).tolist())
                        if s['h']<60 or np.ptp(s['p'][:,0])>s['h']*1.7:continue
                        if (s['p'][10:12,1].mean()-s['hip'][1])<s['h']*.25:continue
                        if prior and np.linalg.norm(s['hip']-prior[:2])>prior[2]*.65:continue
                        add_person(people[stem],s)
                    if people[stem] and prior is None:break
                if people[stem]:recovered+=1
    print('Empty frame retries',attempted,recovered,flush=True)
    return {'framesRetried':attempted,'framesRecovered':recovered}


def build():
    cv2.setNumThreads(1)
    OUT.mkdir(exist_ok=True)
    manifest={code:{'name':name,'code':code,'cameras':{},'images':0,'poses':0,'tracks':0,'missing':0}
              for code,name in NAMES.items()}
    counts=Counter();parts=defaultdict(list);indices=defaultdict(list)
    best={};best_score={}
    def flush(key):
        if parts[key]:
            save(f'{key}-{(len(indices[key])-1)//48}',parts[key]);parts[key]=[]
    with ExitStack() as stack:
        zips={p.name:stack.enter_context(zipfile.ZipFile(p)) for p in archives()}
        source,groups=read_sources(zips)
        people,filter_metrics=read_people(source)
        recovery=recover_empty(source,groups,people,zips)
        for seg,stems in sorted(groups.items()):
            t=tokens(seg);code,cam=t[8],t[4];key=code+'-'+cam
            item=manifest[code]
            item['images']+=len(stems)
            camera=item['cameras'].setdefault(cam,{'images':0,'poses':0,'tracks':0,'missing':0})
            camera['images']+=len(stems)
            imgs={}
            for stem in stems:
                z,m=source[stem]
                imgs[stem]=cv2.imdecode(np.frombuffer(zips[z].read(m),np.uint8),cv2.IMREAD_REDUCED_COLOR_2)
            used_ids=set()
            for track in link_frames(stems,people):
                frames=[];quality=[]
                for n,stem,p in track:
                    archive,member=source[stem]
                    rect,img=appearance(imgs[stem],p['p'] if p else None)
                    f={'index':n,'member':Path(member).name,'archive':archive,'rect':rect,'image':img}
                    if p:
                        f.update(input=p['p'].round(1).tolist(),method=p['method'])
                        if p['world'] is not None:f['world']=p['world']
                        quality.append(p['confidence']*min(1,p['h']/245))
                    frames.append(f)
                missing=not quality
                n,stem,p=track[0]
                suffix='unread' if missing else str(int(round(p['hip'][0])))+'x'+str(int(round(p['hip'][1])))
                tid=stem+'-'+suffix
                if tid in used_ids:tid+='-p'+str(len(used_ids)+1)
                used_ids.add(tid)
                ix=len(indices[key])
                row={'id':tid,'source':seg,'camera':cam,'code':code,'name':item['name'],'frames':frames,'missing':missing}
                # Index rows address a particular source person and frame while keeping photos lazy.
                indices[key].append([tid,len(track),n,track[-1][0],missing])
                parts[key].append(row)
                if missing:item['missing']+=1;camera['missing']+=1
                else:
                    for obj in [item,camera]:
                        obj['poses']+=len(track);obj['tracks']+=1
                    counts.update(f['method'] for f in frames)
                    wrist=max(max(np.linalg.norm(p['p'][4:6]-p['p'][0:2],axis=1))/p['h'] for _,_,p in track)
                    score=min(len(track),5)*.20+np.mean(quality)+min(.75,wrist)
                    if score>best_score.get(code,-1):
                        best_score[code]=score;best[code]={**row,'caseIndex':ix}
                if len(parts[key])==48:flush(key)
        for key,rows in indices.items():
            flush(key);save(key+'-index',rows)
        for code,obj in manifest.items():
            if code not in best:raise ValueError('No renderable pose for '+code)
            obj['representative']=best[code]
        totals={'images':len(source),'archives':len(zips),'codes':len(manifest),'cameras':len(set(k for x in manifest.values() for k in x['cameras'])),
                'tracks':sum(x['tracks'] for x in manifest.values()),'poses':sum(x['poses'] for x in manifest.values()),
                'missing':sum(x['missing'] for x in manifest.values()),'methods':counts,'playerFilter':filter_metrics,'recovery':recovery}
        save('manifest',{'stats':totals,'groups':list(manifest.values())})
        print(totals,flush=True)


if __name__=='__main__':build()
