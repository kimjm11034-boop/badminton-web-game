"""Verify the exported glTF hierarchy and animation, independently of the retarget solver."""
import json,struct,pathlib
import numpy as np
from scipy.spatial.transform import Rotation
p=pathlib.Path(__file__).resolve().parents[1];blob=(p/'athlete.glb').read_bytes();cache=p.parent/'.cache/court-studio'
assert struct.unpack_from('<4sII',blob)==(b'glTF',2,len(blob))
size,=struct.unpack_from('<I',blob,12);g=json.loads(blob[20:20+size]);data=memoryview(blob)[28+size:]
def accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'VEC2':2,'VEC3':3,'VEC4':4,'SCALAR':1,'MAT4':16}[a['type']]
 return np.frombuffer(data,dtype={5121:'u1',5123:'<u2',5126:'<f4'}[a['componentType']],count=a['count']*n,offset=v['byteOffset']).reshape(-1,n)
names={node['name']:i for i,node in enumerate(g['nodes'])};bones=g['skins'][0]['joints'];sensors={v['id']:v for v in json.loads((cache/'sensor.json').read_text(encoding='utf8'))}
catalog={c['id']:c for c in json.loads((p/'catalog.json').read_text(encoding='utf8'))};assert len(g['animations'])==len(catalog)
parents={i:k for k,node in enumerate(g['nodes']) for i in node.get('children',[])}
mapping={'hip':'upperleg01','knee':'lowerleg01','ankle':'foot','shoulder':'upperarm01','elbow':'lowerarm01','wrist':'wrist'}
az=np.deg2rad(np.arange(0,360,5));all_errors=[];all_pixels=[];per={};frames=0
turns={}
# Average the actually skinned side panels of the shorts and the jersey.
# Linear blend skinning lets us accumulate their weighted bind offsets once.
panel_specs={'shorts':('Midnight woven shorts',1.00),'jersey':('Astra / woven court jersey',1.42)}
panels={}
bind=accessor(g['skins'][0]['inverseBindMatrices']).reshape(-1,4,4)[:,3,:3]
for key,(material,height) in panel_specs.items():
 points=[[],[]]
 for prim in g['meshes'][0]['primitives']:
  if g['materials'][prim['material']]['name']!=material:continue
  a=prim['attributes'];v=accessor(a['POSITION']);j=accessor(a['JOINTS_0']);w=accessor(a['WEIGHTS_0'])
  for side,sign in enumerate([-1,1]):
   ids=np.flatnonzero((abs(v[:,1]-height)<.034)&(v[:,0]*sign>.104)&(v[:,0]*sign<.18)&(abs(v[:,2])<.09))
   points[side].extend(zip(v[ids],j[ids],w[ids]))
 coeff=np.zeros((2,len(bones),4))
 for side,vertices in enumerate(points):
  assert len(vertices)>=3,(key,side,len(vertices))
  for pos,indices,weights in vertices:
   for b,w in zip(indices,weights):
    coeff[side,b,:3]+=w*(pos+bind[b]);coeff[side,b,3]+=w
  coeff[side]/=len(vertices)
 panels[key]=coeff
def spread(a):return round(float(np.ptp(a)),2)
def heading(rotation):
 forward=rotation.apply([0.,0,1.])
 return np.rad2deg(np.unwrap(np.arctan2(forward[:,0],forward[:,2])))
for mesh in g['meshes']:
 for prim in mesh['primitives']:
  attrs=prim['attributes'];verts=accessor(attrs['POSITION']);assert np.isfinite(verts).all() and accessor(prim['indices']).max()<len(verts)
  if 'WEIGHTS_0' in attrs:assert np.max(abs(accessor(attrs['WEIGHTS_0']).sum(1)-1))<.0001 and accessor(attrs['JOINTS_0']).max()<len(bones)
for anim in g['animations']:
 name=anim['name'];qs={};ps={}
 for ch in anim['channels']:
  sampler=anim['samplers'][ch['sampler']];t=accessor(sampler['input'])[:,0];val=accessor(sampler['output'])
  assert len(val)==len(t) and np.all(np.diff(t)>0) and np.isfinite(val).all() and abs(t[-1]-catalog[name]['duration'])<1e-5
  if ch['target']['path']=='rotation':
   assert np.max(abs(np.linalg.norm(val,axis=1)-1))<.00001;qs[ch['target']['node']]=Rotation.from_quat(val)
  else:ps[ch['target']['node']]=val
 frames+=len(t)
 world={};loc={}
 for i in bones:
  par=parents.get(i);v=ps.get(i,np.broadcast_to(g['nodes'][i]['translation'],(len(t),3)));q=qs[i]
  world[i]=q if par is None else world[par]*q
  loc[i]=v if par is None else loc[par]+world[par].apply(np.array(v,dtype=float,copy=True))
 hip=heading(world[names['root']]);chest=heading(world[names['spine01']])
 surface={}
 for key,coef in panels.items():
  delta=coef[1]-coef[0]
  line=sum(world[i].apply(d[:3])+loc[i]*d[3] for i,d in zip(bones,delta) if np.any(d))
  surface[key]=np.rad2deg(np.unwrap(np.arctan2(-line[:,2],line[:,0])))
 relative=(chest-hip+180)%360-180
 stats={'pelvisRangeDeg':spread(hip),'thoraxRangeDeg':spread(chest),'relativeRangeDeg':spread(chest-hip),
        'maxAbsoluteSeparationDeg':round(float(np.max(np.abs(relative))),2),
        'skinnedShortsRangeDeg':spread(surface['shorts']),'skinnedJerseyRangeDeg':spread(surface['jersey'])}
 turns[name]=stats
 contact=catalog[name]['contact']
 if contact is not None and catalog[name]['source'] in ('photo','blended','authored'):
  assert stats['maxAbsoluteSeparationDeg']<=44.1,(name,stats)
  u=t/t[-1];window=np.flatnonzero((u>=contact-.18)&(u<=contact+.09))
  def release(axis):
   speed=np.gradient(axis,t);return t[window[np.argmax(np.abs(speed[window]))]]
  stats['pelvisLeadMs']=round(float((release(chest)-release(hip))*1000),1)
  if name in ('smash','jump-smash','high-clear','drop','cut','drive','back-smash'):
   assert stats['pelvisLeadMs']>0 and min(stats['skinnedShortsRangeDeg'],stats['skinnedJerseyRangeDeg'])>20, (name,stats)
 if name not in sensors:continue
 ref=sensors[name]['frames']
 gaps=np.stack([loc[names[b+'.'+s]]-np.asarray([row[k+s] for row in ref])*[-1,1,-1] for k,b in mapping.items() for s in ['L','R']])
 err=np.linalg.norm(gaps,axis=-1).ravel();proj=np.hypot(gaps[...,0,None]*np.cos(az)-gaps[...,2,None]*np.sin(az),gaps[...,1,None]).ravel()
 per[name]={'frames':len(t),'meanCm':float(err.mean()*100),'within3cm':float((err<=.03).mean()),'horizontal72ViewsWithin3cm':float((proj<=.03).mean())}
 assert abs(per[name]['meanCm']-catalog[name]['evaluation']['meanCm'])<.0003
 all_errors.extend(err);all_pixels.extend(proj)
e=np.array(all_errors);px=np.array(all_pixels)
out={'animationCount':len(catalog),'bakedFrameCount':frames,'boneCount':len(bones),'jointEvaluations':len(e),'projectedEvaluations':len(px),'sensorMeanCm':float(e.mean()*100),'sensorWithin3cm':float((e<=.03).mean()),'projectedWithin3cm':float((px<=.03).mean()),'maxSensorErrorCm':float(e.max()*100),'perCapture':per}
out['bodyRotation']=turns
(p/'evidence/verification.json').write_text(json.dumps(out,indent=2),encoding='utf8');print({k:v for k,v in out.items() if k not in ('perCapture','bodyRotation')});print('smash',turns['smash'])
