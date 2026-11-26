import json,numpy as np
from pathlib import Path
root=Path(__file__).resolve().parents[1];data=json.loads((root/'data/footwork-reference.json').read_text(encoding='utf8'))
base=data['frames'][0]['joints'];vec=lambda j,n:np.array(j[n]['world']);unit=lambda a:a/np.linalg.norm(a)
right=unit(vec(base,'hipR')-vec(base,'hipL'));up=unit((vec(base,'shoulderL')+vec(base,'shoulderR')-vec(base,'hipL')-vec(base,'hipR'))/2);forward=unit(np.cross(up,right));up=unit(np.cross(right,forward))
clips=[]
for frame in data['frames']:
 j=frame['joints'];hip=(vec(j,'hipL')+vec(j,'hipR'))/2
 # 각 프레임의 골반 회전을 제거한 선수 로컬 축. 화면 좌우를 단순 반전하지 않습니다.
 right=unit(vec(j,'hipR')-vec(j,'hipL'));up=unit((vec(j,'shoulderL')+vec(j,'shoulderR'))/2-hip);forward=unit(np.cross(up,right));up=unit(np.cross(right,forward))
 local={}
 for name in j:
  v=vec(j,name)-hip;local[name]=[round(float(v@right),4),round(float(v@forward),4),round(float(v@up),4)]
 clips.append({'time':frame['time'],'joints':local,'angles':frame['angles']})
module='// MediaPipe 추정 좌표를 해부학적 우측/전방/상방 축으로 변환. 원본: data/footwork-reference.json\nexport const footworkClips='+json.dumps(clips,separators=(',',':'))+';\n'
(root/'footwork-clips.js').write_text(module,encoding='utf8');print([(c['time'],c['joints']['ankleL'],c['joints']['ankleR']) for c in clips])
