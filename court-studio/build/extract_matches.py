"""Recover real rally trajectories from the authors' ShuttleSet 3D pose estimates."""
import csv,io,json,locale,os,pathlib
import numpy as np
from scipy.ndimage import gaussian_filter1d
if os.name=='nt':os.environ.setdefault('LIBARCHIVE',os.path.join(os.environ['SystemRoot'],'System32','archiveint.dll'));locale.setlocale(locale.LC_CTYPE,'.UTF-8')
import libarchive
here=pathlib.Path(__file__).resolve().parents[2]/'.cache/court-studio';base=here/'bst'
info={r['id']:r for r in csv.DictReader((base/'match.csv').open(encoding='utf-8-sig',newline=''))}
spec={'放小球':('net','헤어핀','Net shot','전위',.25),'擋小球':('block','블록 수비','Defensive block','중위',.10),'殺球':('smash','스매시','Smash','후위',.78),'挑球':('lift','언더 리프트','Lift','전위',.07),'長球':('clear','클리어','Clear','후위',.73),'平球':('drive','드라이브','Drive','중위',.42),'切球':('drop','드롭·커트','Drop / slice','후위',.70),'推球':('push','푸시','Push','전위',.41),'撲球':('kill','네트 킬','Net kill','전위',.50),'勾球':('cross-net','크로스 헤어핀','Cross-court net','전위',.19),'發短球':('short-serve','쇼트 서브','Short serve','서브',.13),'發長球':('long-serve','롱 서브','Long serve','서브',.13)}
def norm(a):return a/np.maximum(1e-8,np.linalg.norm(a,axis=-1,keepdims=True))
best={};last=None;seen=0
with libarchive.file_reader(str((base/'matches.rar').resolve())) as archive:
 for e in archive:
  path=pathlib.PurePosixPath(e.pathname or '');parts=path.parts
  if len(parts)!=4 or parts[1]!='test' or not parts[2].startswith('Bottom_'):continue
  label=parts[2][7:]
  if label not in spec:continue
  if path.name.endswith('_joints.npy'):
   last=(path,np.load(io.BytesIO(b''.join(e.get_blocks())),allow_pickle=False));continue
  if not path.name.endswith('_pos.npy') or last is None or path.name.replace('_pos','_joints')!=last[0].name:continue
  p=last[1][:,1];pos=np.load(io.BytesIO(b''.join(e.get_blocks())),allow_pickle=False)[:,1];seen+=1
  if len(p)<17 or len(p)>75 or not np.isfinite(p).all() or np.any(np.abs(p).max(axis=(1,2))<.01):continue
  # human3d uses H36M joint order, with Z up, and re-bases the lowest joint per image.
  if np.median(p[:,10,2]-p[:,0,2])<.4:continue
  p=p[:,:,[0,2,1]]*[-1,1,1]
  p=gaussian_filter1d(p,.68,axis=0,mode='nearest')
  def length(i,j):return np.linalg.norm(p[:,i]-p[:,j],axis=1)
  leg=.5*(length(1,2)+length(2,3)+length(4,5)+length(5,6))
  sc=.872/np.median(leg);p*=sc
  if np.max(np.linalg.norm(np.diff(p[:,[13,16]],axis=0),axis=-1))>.6 or np.std(leg)>.08:continue
  centre=len(p)//2;st=slice(max(0,centre-3),centre+4);wr=p[:,16]-p[:,0];wl=p[:,13]-p[:,0]
  vr=np.linalg.norm(np.diff(wr,axis=0),axis=1);vl=np.linalg.norm(np.diff(wl,axis=0),axis=1)
  # Prefer the acting right arm, stable limb tracking and a wrist elevation consistent with the event.
  quality=-abs(wr[st,1].mean()-spec[label][4])*2+min(np.max(vr[st]),.25)-max(0,np.max(vl[st])-np.max(vr[st]))*2
  quality-=np.quantile(np.linalg.norm(np.diff(p[:,[13,16]],n=2,axis=0),axis=-1),.90)*2
  if label in best and quality<=best[label][0]:continue
  best[label]=(quality,path.name.replace('_pos.npy',''),p,pos)
out=[]
for label,(score,shot,p,pos) in best.items():
 key,name,en,family,_=spec[label];ids=shot.split('_');m=info[ids[0]]
 # Place the near player's foot midpoint on the court trajectory. Vertical flight is unobserved.
 pos=gaussian_filter1d(pos,1.15,axis=0,mode='nearest')
 travel=(pos-pos[0])*np.array([6.1,13.4]);mid=(p[:,3]+p[:,6])*.5
 for axis,col in [(0,0),(2,1)]:p[:,:,axis]+=travel[:,None,col]-mid[:,None,axis]
 p[:,:,1]+=.076-np.minimum(p[:,3,1],p[:,6,1])[:,None]
 idx={'hipR':1,'kneeR':2,'ankleR':3,'hipL':4,'kneeL':5,'ankleL':6,'head':10,'shoulderL':11,'elbowL':12,'wristL':13,'shoulderR':14,'elbowR':15,'wristR':16}
 joints={k:p[:,i] for k,i in idx.items()};right=p[:,1]-p[:,4];right[:,1]=0;front=norm(np.cross(np.repeat([[0.,1.,0.]],len(p),0),norm(right)))
 for s in 'LR':
  ankle=joints['ankle'+s];joints['heel'+s]=ankle-front*.062;joints['toe'+s]=ankle+front*.167
  joints['hand'+s]=joints['wrist'+s]+norm(joints['wrist'+s]-joints['elbow'+s])*.08
 frame=[{k:v[i].round(6).tolist() for k,v in joints.items()} for i in range(len(p))]
 out.append(dict(id='match-'+key,name=name+' · 경기 영상',en=en+' / match',family=family,kind='match',contact=.50,times=np.linspace(0,1,len(p)).round(7).tolist(),frames=frame,
  reference=dict(description=m['tournament']+' '+m['year']+' · '+m['winner']+' / '+m['loser'],match=m['video'],set=int(ids[1]),rally=int(ids[2]),stroke=int(ids[3]),url=m['url'],frames=len(p),shot=shot,label=label,sourcePath='test/Bottom_'+label+'/'+shot+'_joints.npy')))
assert len(out)==12,(len(out),set(spec)-set(best))
(here/'matches.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(seen,'candidate tracks,',len(out),'stroke types,',sum(len(a['frames']) for a in out),'source frames')
