"""사용자 제공 스텝 영상의 시각 프레임에서 관절을 추정하고 근거 이미지를 저장합니다. 모델 재학습이 아닙니다."""
import json,math
from pathlib import Path
import cv2,numpy as np,mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
root=Path(__file__).resolve().parents[1];cache=root/'.cache/pose'
model=vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_buffer=(cache/'pose_landmarker.task').read_bytes()),num_poses=1))
names={11:'shoulderL',12:'shoulderR',13:'elbowL',14:'elbowR',15:'wristL',16:'wristR',19:'handL',20:'handR',23:'hipL',24:'hipR',25:'kneeL',26:'kneeR',27:'ankleL',28:'ankleR',29:'heelL',30:'heelR',31:'toeL',32:'toeR'}
frames=[];tiles=[]
for frame in json.loads((cache/'manifest.json').read_text(encoding='utf8')):
 img=cv2.imdecode(np.fromfile(frame['path'],dtype=np.uint8),cv2.IMREAD_COLOR);r=frame['rect'];x,y,w,h=map(round,[r['x'],r['y'],r['width'],r['height']]);crop=img[max(0,y):y+h,max(0,x):x+w].copy()
 result=model.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(crop,cv2.COLOR_BGR2RGB)))
 if not result.pose_landmarks:continue
 lm=result.pose_landmarks[0];world=result.pose_world_landmarks[0]
 joints={name:{'image':[lm[i].x,lm[i].y],'world':[world[i].x,world[i].y,world[i].z],'visibility':lm[i].visibility} for i,name in names.items()}
 # 해부학적 L/R 유지. 정면 영상은 화면 좌우가 선수 기준과 반대이며 최종 카메라 회전은 게임에서 수행합니다.
 def angle(a,b,c):
  va=np.array(joints[a]['world'])-np.array(joints[b]['world']);vb=np.array(joints[c]['world'])-np.array(joints[b]['world'])
  return float(np.degrees(np.arccos(np.clip(np.dot(va,vb)/(np.linalg.norm(va)*np.linalg.norm(vb)+1e-9),-1,1))))
 angles={'kneeL':angle('hipL','kneeL','ankleL'),'kneeR':angle('hipR','kneeR','ankleR'),'elbowL':angle('shoulderL','elbowL','wristL'),'elbowR':angle('shoulderR','elbowR','wristR')}
 frames.append({'time':frame['time'],'joints':joints,'angles':angles})
 for a,b in [('shoulderL','shoulderR'),('hipL','hipR'),('shoulderL','hipL'),('shoulderR','hipR'),('hipL','kneeL'),('kneeL','ankleL'),('ankleL','toeL'),('hipR','kneeR'),('kneeR','ankleR'),('ankleR','toeR'),('shoulderL','elbowL'),('elbowL','wristL'),('shoulderR','elbowR'),('elbowR','wristR')]:
  pt=lambda k:tuple(int(v*n) for v,n in zip(joints[k]['image'],[crop.shape[1],crop.shape[0]]))
  cv2.line(crop,pt(a),pt(b),(80,240,180),2)
 for name,point in joints.items():
  px,py=(int(v*n) for v,n in zip(point['image'],[crop.shape[1],crop.shape[0]]));cv2.circle(crop,(px,py),4,(0,230,255),-1);cv2.putText(crop,name,(px+3,py-3),cv2.FONT_HERSHEY_SIMPLEX,.28,(255,255,255),1)
 cv2.putText(crop,f"{frame['time']}s | knees {angles['kneeL']:.0f}/{angles['kneeR']:.0f}",(12,24),cv2.FONT_HERSHEY_SIMPLEX,.6,(255,255,255),2)
 tiles.append(cv2.resize(crop,(480,270)))
payload={'source':'https://www.youtube.com/watch?v=iqxuxEubedU','method':'MediaPipe PoseLandmarker Full; sampled video screenshots; estimates, not ground truth or retrained motion model','coordinateSystem':'anatomical L/R; camera-relative 3D estimates in metres, image x-right/y-down; retarget to athlete local before world camera rotation','frames':frames}
(root/'data/footwork-reference.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf8')
if tiles:
 while len(tiles)%3:tiles.append(np.zeros_like(tiles[0]))
 cv2.imencode('.jpg',np.vstack([np.hstack(tiles[i:i+3]) for i in range(0,len(tiles),3)]))[1].tofile(str(root/'data/pose-contact-sheet.jpg'))
print({'detectedFrames':len(frames),'kneeAngles':[(f['time'],round(f['angles']['kneeL']),round(f['angles']['kneeR'])) for f in frames]})
