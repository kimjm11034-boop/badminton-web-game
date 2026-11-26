"""Extract annotated expert trials from MultiSenseBadminton, original 21-joint channels."""
import json,pathlib
import h5py,numpy as np,openpyxl
from scipy.spatial.transform import Rotation
from scipy.ndimage import gaussian_filter1d
root=pathlib.Path(__file__).resolve().parents[2]
cache=root/'.cache/court-studio'
sheet=openpyxl.load_workbook(next((cache/'docs').rglob('Annotation Data File.xlsx')),read_only=True,data_only=True)
rows=[r for r in sheet.active.values if r[0]=='Sub14']
parents=[-1,0,1,2,0,4,5,0,7,8,9,10,11,9,13,14,15,9,17,18,19]
out=[]
def norm(v):return v/np.maximum(np.linalg.norm(v,axis=-1,keepdims=True),1e-8)
for file in sorted(cache.glob('*Sub14.hdf5')):
 clear='14-39-21' in file.name
 with h5py.File(file) as h:
  g=h['pns-joint'];ts=g['global-position/time_s'][:,0];pos=g['global-position/data'][:].reshape(-1,21,3)/100
  qs=g['quaternion/data'][:].reshape(-1,21,4)
 assert np.all(np.diff(ts)>=0)
 trials=[];same=[r for r in rows if ('clear' in str(r[4]).lower())==clear]
 for r in same:
  if r[5]!='Expert' or r[9]!='Good':continue
  tt=np.arange(r[1],r[2],1/60);i=np.searchsorted(ts,tt)
  if len(i)<45 or i.min()<1 or i.max()>=len(ts):continue
  # Interpolate positions against logged wall-clock times. Reject dropped segments.
  if np.max(ts[i]-ts[i-1])>.085:continue
  alpha=((tt-ts[i-1])/np.maximum(ts[i]-ts[i-1],1e-8))[:,None,None]
  p=pos[i-1]*(1-alpha)+pos[i]*alpha
  vel=np.linalg.norm(np.gradient(gaussian_filter1d(p[:,16]-p[:,0],1,axis=0),1/60,axis=0),axis=1)
  peak=int(np.argmax(vel));height=p[peak,16,1]-p[peak,0,1]
  if peak<16 or len(p)-peak<16 or (clear and height<.48):continue
  trials.append((r,tt,i,p,peak,float(vel[peak])))
 if not trials:raise ValueError(file)
 median=np.median([a[-1] for a in trials]);trials.sort(key=lambda t:abs(t[-1]-median))
 picked=[trials[0],max(trials,key=lambda t:t[-1]),trials[len(trials)//2]]
 # Calibrate one estimated grip direction for each stroke family on OTHER repetitions.
 # It is an alignment constraint. There is no racket-mounted motion sensor.
 axes_in_hand=[]
 for row,_,indices,p,peak,_ in trials:
  if row[3] in {item[0][3] for item in picked}:continue
  right=p[:8,1].mean(0)-p[:8,4].mean(0);right[1]=0;right=norm(right)
  up=np.array([0.,1.,0.]);court=np.column_stack((right,up,np.cross(right,up)))
  target=(norm(np.array([.18,.89,-.42])) if clear else norm(np.array([-.64,.56,-.53])))@court.T
  rot=Rotation.identity()
  for k in [0,7,8,9,13,14,15,16]:
   rot=rot*Rotation.from_quat(qs[indices[peak],k][[1,2,3,0]])
  axes_in_hand.append(rot.inv().apply(target))
 grip=norm(np.median(axes_in_hand,axis=0))
 for variant,(r,tt,indices,positions,peak,speed) in enumerate(picked):
  begin=max(0,peak-(58 if clear else 38));end=min(len(tt),peak+(56 if clear else 46));ii=indices[begin:end];p=positions[begin:end].copy()
  # Estimate facing once at entry. Preserve hip, shoulder and limb rotation throughout the stroke.
  right=p[:8,1].mean(0)-p[:8,4].mean(0);right[1]=0;right=norm(right);up=np.array([0.,1.,0.]);back=np.cross(right,up);axes=np.column_stack((right,up,back))
  # Use model/source mean leg length ratio so that location residuals compare homologous segments.
  seg=np.linalg.norm(p[:,2]-p[:,1],axis=1)+np.linalg.norm(p[:,3]-p[:,2],axis=1);scale=.872/np.median(seg)
  origin=p[:4,0].mean(0);origin[1]=np.quantile(p[:,[3,6],1],.06)-.076/scale
  coords=(p-origin)@axes*scale;quats=qs[ii];orient=[]
  for k,parent in enumerate(parents):
   rot=Rotation.from_quat(quats[:,k][:,[1,2,3,0]])
   orient.append(rot if parent<0 else orient[parent]*rot)
  derived={}
  for s,idx,sgn in [('R',16,-1),('L',20,1)]:
   hand=orient[idx].apply([sgn,0,0])@axes;derived['hand'+s]=coords[:,idx]+hand*.08
   foot=3 if s=='R' else 6
   forward=orient[foot].apply([0,0,1])@axes;derived['heel'+s]=coords[:,foot]-forward*.06;derived['toe'+s]=coords[:,foot]+forward*.17
  # The racket has no sensor. A fixed estimated grip axis uses measured global hand orientation.
  derived['shaft']=norm(orient[16].apply(grip)@axes)
  derived['headUp']=norm(orient[12].apply([0,1,0])@axes);derived['headRight']=norm(orient[12].apply([-1,0,0])@axes)
  ids={'hipR':1,'kneeR':2,'ankleR':3,'hipL':4,'kneeL':5,'ankleL':6,'head':12,'shoulderR':14,'elbowR':15,'wristR':16,'shoulderL':18,'elbowL':19,'wristL':20}
  frames=[{**{k:coords[t,j].round(6).tolist() for k,j in ids.items()},**{k:a[t].round(6).tolist() for k,a in derived.items()}} for t in range(len(ii))]
  name='포핸드 클리어' if clear else '백핸드 드라이브'
  out.append(dict(id=('capture-clear-' if clear else 'capture-drive-')+str(variant+1),name=name+' · 실측 '+str(variant+1),en='Captured forehand clear' if clear else 'Captured backhand drive',family='후위' if clear else '중위',contact=(peak-begin)/(len(ii)-1),times=np.round(np.arange(len(ii))/60,7).tolist(),frames=frames,
   reference=dict(description=f'MultiSenseBadminton · 전문가 등급 Sub14 · {r[3]}번 타구',file=file.name,trial=r[3],startUnix=tt[begin],endUnix=tt[end-1],peakWristSpeed=speed,scale=scale)))
 print(file.name,len(same),'labelled,',len(trials),'eligible; selected',[(t[0][3],round(t[-1],1)) for t in picked])
(cache/'sensor.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf8')
