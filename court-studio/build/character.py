"""Build a textured, skinned court athlete and equipment in glTF 2.0."""
from pathlib import Path
import io,json,struct,zlib,math
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from proportions import shape
HERE=Path(__file__).resolve().parents[1]
ASSET=HERE/'assets'
SOURCE=json.loads((ASSET/'asset.json').read_text())
blob=zlib.decompress((ASSET/'body.bin.z').read_bytes())
types={'Uint8Array':'u1','Int8Array':'i1','Uint16Array':'<u2','Int16Array':'<i2','Float32Array':'<f4'}
def load(name):
 a=SOURCE['layout'][name]
 return np.frombuffer(blob,dtype=types[a['type']],offset=a['offset'],count=a['length']).reshape(-1,a['itemSize'])
g={'asset':{'version':'2.0','generator':'Astra Court / character build'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'skins':[],'meshes':[],'materials':[],'textures':[],'images':[],'bufferViews':[],'accessors':[],'animations':[]}
binary=bytearray()
def view(data):
 while len(binary)%4:binary.append(0)
 start=len(binary);binary.extend(data);g['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(data)});return len(g['bufferViews'])-1
def acc(a,typ=None,limits=False):
 a=np.ascontiguousarray(a);n=a.shape[-1] if a.ndim>1 else 1
 obj={'bufferView':view(a.tobytes()),'componentType':{'f':5126,'B':5121,'H':5123,'I':5125}[a.dtype.char],'count':len(a),'type':typ or {1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4',16:'MAT4'}[n]}
 if limits:obj.update(min=a.reshape(len(a),-1).min(0).tolist(),max=a.reshape(len(a),-1).max(0).tolist())
 g['accessors'].append(obj);return len(g['accessors'])-1
def tex(data,mime):
 i=len(g['images']);g['images'].append({'bufferView':view(data),'mimeType':mime});g['textures'].append({'source':i});return {'index':i}
def material(name,color=(1,1,1),texture=None,mask=False,metal=0):
 p={'baseColorFactor':[*color,1],'roughnessFactor':.66 if metal else .87,'metallicFactor':metal}
 if texture:p['baseColorTexture']=texture
 m={'name':name,'pbrMetallicRoughness':p}
 if mask:m.update(alphaMode='MASK',alphaCutoff=.30,doubleSided=True)
 g['materials'].append(m);return len(g['materials'])-1
def filetex(name):return tex((ASSET/name).read_bytes(),'image/png' if name.endswith('.png') else 'image/jpeg')
def kit():
 w,h=1536,768;y,x=np.mgrid[0:h,0:w];u=x/w;v=y/h
 a=np.zeros((h,w,3));a[:]=[27,67,77]
 front=(u<.5);local=(u%.5)*2
 field=v+.32*local
 for lo,hi,col in [(.34,.61,[27,112,117]),(.61,.74,[33,143,139]),(.74,1.4,[29,102,110])]:a[(field>lo)&(field<hi)]=col
 a[(local<.10)|(local>.91)]=[20,49,65]
 stripe=(field>.60)&(field<.615);a[stripe]=[193,224,91]
 a+=((x%3==0)*1.3+(y%2==0)*1.2)[...,None];im=Image.fromarray(a.clip(0,255).astype('uint8'));d=ImageDraw.Draw(im)
 def mark(pt,s,size):
  try:f=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',size)
  except OSError:f=ImageFont.load_default()
  d.text(pt,s,font=f,fill=(246,248,220),anchor='mm')
 mark((w*.75,h*.36),'K O R E A',44);mark((w*.75,h*.44),'07',44);mark((w*.31,h*.34),'ASTRA',22)
 d.rectangle([w*.19,h*.322,w*.215,h*.345],fill=(240,244,227));d.rectangle([w*.19,h*.342,w*.215,h*.348],fill=(209,113,83))
 out=io.BytesIO();im.save(out,format='JPEG',quality=93);return tex(out.getvalue(),'image/jpeg')
skin=material('Skin · 2K',texture=filetex('skin-asian.jpg'));shirt=material('Astra / woven court jersey',texture=kit())
shorts=material('Midnight woven shorts',(.023,.041,.062));shoe=material('Court rubber',(.77,.83,.80))
eye=material('Brown eyes',texture=filetex('eye-brown.jpg'));brow=material('Eyebrows',texture=filetex('brows.png'),mask=True)
lash=material('Lashes',texture=filetex('lashes.png'),mask=True);hair=material('Short textured hair',texture=filetex('hair-short04.png'),mask=True)
ink=material('Graphite',(.025,.045,.052),metal=.25);lime=material('Acid welt',(.55,.78,.14));string=material('String bed',(.72,.77,.72))
rest=np.array([shape(*b['head']) for b in SOURCE['skeleton']]);names=[b['name'] for b in SOURCE['skeleton']]
for i,b in enumerate(SOURCE['skeleton']):
 pa=b['parent'];node={'name':b['name'],'translation':(rest[i]-(rest[pa] if pa>=0 else 0)).tolist()}
 g['nodes'].append(node)
 if pa>=0:g['nodes'][pa].setdefault('children',[]).append(i)
g['scenes'][0]['nodes'].append(0)
ib=np.repeat(np.eye(4)[None],len(rest),0);ib[:,3,:3]=-rest
g['skins'].append({'joints':list(range(len(rest))),'inverseBindMatrices':acc(ib.reshape(-1,16).astype('f4'),'MAT4'),'skeleton':0})
def mesh(name,parts,parent=None,skin_id=None):
 i=len(g['nodes']);o={'name':name,'mesh':len(g['meshes'])};g['meshes'].append({'name':name,'primitives':parts})
 if skin_id is not None:o['skin']=skin_id
 g['nodes'].append(o)
 if parent is None:g['scenes'][0]['nodes'].append(i)
 else:g['nodes'][parent].setdefault('children',[]).append(i)
 return i
def primitive(pos,ind,mat,norm=None,uv=None,joints=None,weights=None):
 if joints is not None:pos=np.array([shape(*p) for p in pos])
 attrs={'POSITION':acc(np.asarray(pos,'f4'),limits=True)}
 if norm is not None:attrs['NORMAL']=acc(np.asarray(norm,'f4'))
 if uv is not None:attrs['TEXCOORD_0']=acc(np.asarray(uv,'f4'))
 if joints is not None:attrs.update(JOINTS_0=acc(np.asarray(joints,'u1')),WEIGHTS_0=acc(np.asarray(weights,'f4')))
 return {'attributes':attrs,'indices':acc(np.asarray(ind,'u2').ravel()),'material':mat}
pos=load('position').copy();norm=load('normal')/127;norm/=np.maximum(.001,np.linalg.norm(norm,axis=1,keepdims=True));uv=load('uv')/65535;uv[:,1]=1-uv[:,1]
joints=load('skinIndex');weights=load('skinWeight')/255;weights/=np.maximum(.001,weights.sum(1,keepdims=True))
idx=load('index').ravel();parts=[]
def part(faces,mat,offset=0,jersey=False,back=False):
 if not faces.size:return
 ids,inv=np.unique(faces,return_inverse=True);p=pos[ids]+norm[ids]*offset;t=uv[ids].copy()
 if jersey:
  half=.39
  t[:,0]=(.75-p[:,0]/(4*half)) if back else (.25+p[:,0]/(4*half))
  t[:,1]=(1.58-p[:,1])/.57
 parts.append(primitive(p,inv,mat,norm[ids],t,joints[ids],weights[ids]))
def garment(faces,field,mat,thickness,textured=False):
 # Clip each triangle to tailored hemlines. Interpolate skin weights at cuts.
 distance=field(pos);visible=faces[distance[faces].max(1)>=0]
 for back in ([False,True] if textured else [False]):
  fs=visible[(norm[visible,2].mean(1)<0)==back] if textured else visible
  out=[];tri=[];lookup={}
  def add(a,b,t):
   key=(a,b,round(t,6))
   if key in lookup:return lookup[key]
   p=pos[a]*(1-t)+pos[b]*t;n=norm[a]*(1-t)+norm[b]*t;n/=max(.001,np.linalg.norm(n))
   weight={}
   for index,factor in [(a,1-t),(b,t)]:
    for j,w in zip(joints[index],weights[index]):weight[j]=weight.get(j,0)+w*factor
   wt=sorted(weight.items(),key=lambda v:-v[1])[:4];wt=(wt+[(0,0)]*4)[:4];w=np.array([v[1] for v in wt]);w/=w.sum()
   p=p+n*thickness
   texcoord=[(.75-p[0]/1.56) if back else (.25+p[0]/1.56),(1.58-p[1])/.57]
   lookup[key]=len(out);out.append((p,n,texcoord,[v[0] for v in wt],w));return len(out)-1
  for f in fs:
   poly=[]
   for a,b in zip(f,np.roll(f,-1)):
    if distance[a]>=0:poly.append(add(a,a,0))
    if (distance[a]>=0)!=(distance[b]>=0):
     a,b=sorted([a,b]);poly.append(add(a,b,distance[a]/(distance[a]-distance[b])))
   for k in range(1,len(poly)-1):tri.extend([poly[0],poly[k],poly[k+1]])
  if tri:
   p,n,t,j,w=map(np.array,zip(*out));parts.append(primitive(p,tri,mat,n,t if textured else None,j,w))
def jersey_field(p):
 x,y,z=p.T;x=np.abs(x)
 neck=1.565-(.052+.018*np.tanh((z-.03)*16))*np.maximum(0,1-(x/.101)**2)
 sleeve=.323-x+.30*(y-1.36)
 return np.minimum.reduce([y-1.075,neck-y,sleeve])
def shorts_field(p):
 return np.minimum.reduce([p[:,1]-.797,1.113-p[:,1],.31-np.abs(p[:,0])])
for group in SOURCE['groups']:
 name=group['name'];f=idx[group['start']:group['start']+group['count']].reshape(-1,3)
 if name=='body':
  y=pos[f,1].mean(1)
  field=jersey_field(pos)
  # Keep skin at each garment opening and remove fully covered triangles.
  short_field=shorts_field(pos)
  part(f[(field[f].min(1)<0)&(short_field[f].min(1)<0)&(y>.075)],skin)
  garment(f,jersey_field,shirt,.010,True)
  garment(f,shorts_field,shorts,.016)
  garment(f,lambda p:np.minimum.reduce([jersey_field(p),.009-jersey_field(p),p[:,1]-1.33]),shirt,.011,True)
 elif name=='eyes':
  # The atlas's white corner is the transparent corneal shell, not sclera.
  cornea=(uv[f,0].mean(1)>.84)&(uv[f,1].mean(1)>.84)
  part(f[~cornea],eye)
 elif name in ['brows','lashes','hair:short04']:part(f,{'brows':brow,'lashes':lash,'hair:short04':hair}[name])
mesh('Astra · match kit 07',parts,skin_id=0)
def tube(a,b,r,m,k=8,r2=None):
 a,b=np.array(a),np.array(b);ax=b-a;ax/=np.linalg.norm(ax);u=np.cross(ax,[1,0,0] if abs(ax[0])<.85 else [0,1,0]);u/=np.linalg.norm(u);v=np.cross(ax,u)
 ring=np.array([u*math.cos(2*math.pi*i/k)+v*math.sin(2*math.pi*i/k) for i in range(k)])
 pts=np.r_[a+ring*r,b+ring*(r if r2 is None else r2)];ids=[]
 for i in range(k):
  j=(i+1)%k;ids.extend([i,j,k+i,j,k+j,k+i])
 return primitive(pts,ids,m,np.r_[ring,ring])
def combine_tubes(segments,mat,k=8):
 # One mesh primitive per material for all strings, grip ridges or laces.
 ps=[];ns=[];ix=[]
 for a,b,r in segments:
  a,b=np.asarray(a,dtype=float),np.asarray(b,dtype=float);d=b-a;d/=np.linalg.norm(d);u=np.cross(d,[1,0,0] if abs(d[0])<.85 else [0,1,0]);u/=np.linalg.norm(u);v=np.cross(d,u)
  rings=np.array([u*math.cos(2*math.pi*i/k)+v*math.sin(2*math.pi*i/k) for i in range(k)]);base=len(ps)
  ps.extend(a+r*rings);ps.extend(b+r*rings);ns.extend(rings);ns.extend(rings)
  for i in range(k):
   j=(i+1)%k;ix.extend(base+t for t in [i,j,k+i,j,k+j,k+i])
 return primitive(ps,ix,mat,ns)
def shoe_part(rows,mat):
 pts=[];ids=[];k=40
 for i,(y,w,front,rear) in enumerate(rows):
  for j in range(k):
   a=2*math.pi*j/k;s=math.sin(a);c=math.cos(a);pts.append([w*np.sign(c)*abs(c)**.77*(1+.10*s),y,(front if s>0 else rear)*np.sign(s)*abs(s)**.72+.025])
   if i:
    h=(i-1)*k+j;t=(i-1)*k+(j+1)%k;ids+= [h,h+k,t,t,h+k,t+k]
 pts=np.array(pts);fs=np.array(ids).reshape(-1,3);n=np.zeros_like(pts);fn=np.cross(pts[fs[:,1]]-pts[fs[:,0]],pts[fs[:,2]]-pts[fs[:,0]])
 for j in range(3):np.add.at(n,fs[:,j],fn)
 n/=np.maximum(.00001,np.linalg.norm(n,axis=1,keepdims=True));return primitive(pts,ids,mat,n)
for side in ['L','R']:
 shoe_parts=[shoe_part([(-.076,.001,.001,.001),(-.076,.061,.181,.098),(-.070,.066,.184,.096),(-.066,.067,.184,.096)],ink),
 shoe_part([(-.067,.067,.184,.096),(-.059,.068,.181,.095),(-.047,.066,.177,.094)],shoe),
 shoe_part([(-.05,.066,.181,.096),(-.040,.065,.177,.095),(-.026,.060,.17,.09),(-.011,.053,.145,.077),(.006,.046,.085,.060),(.02,.038,.048,.047),(.021,.027,.028,.035)],shoe)]
 lines=[([-.021,.005+i*.003,.123-i*.011],[.021,.006+i*.003,.117-i*.011],.0021) for i in range(6)]
 for sidewall in [-1,1]:
  lines+= [([sidewall*.054,-.037,.134],[sidewall*.061,-.023,.065],.004),([sidewall*.061,-.023,.065],[sidewall*.057,-.038,-.014],.005)]
 shoe_parts.append(shoe_part([(.018,.034,.031,.044),(.037,.034,.032,.044),(.066,.035,.033,.045)],shoe))
 shoe_parts.append(shoe_part([(.055,.0355,.0335,.0455),(.059,.0355,.0335,.0455)],ink))
 shoe_parts.append(combine_tubes(lines,ink));mesh('Court shoe '+side,shoe_parts,names.index('foot.'+side))
# Handle origin is the centre of the wrapped grip.
rim=[];strings=[];center=.455;rx=.100;ry=.131
for i in range(96):
 def pt(j):
  a=j*math.tau/96;return [rx*math.cos(a)*(1+.07*math.sin(a)),center+ry*math.sin(a),0]
 rim.append((pt(i),pt(i+1),.0047))
for i in range(-10,11):
 x=i*.0086;y=ry*math.sqrt(1-(x/rx)**2);strings.append(([x,center-y,0],[x,center+y,0],.00063))
for i in range(-11,12):
 y=i*.0106;x=rx*math.sqrt(1-(y/ry)**2)*(1+.07*y/ry);strings.append(([-x,center+y,.0003],[x,center+y,.0003],.00063))
grip=[]
for j in range(144):
 def at(i):return [.0141*math.cos(i*.48),-.085+i*.00114,.0141*math.sin(i*.48)]
 grip.append((at(j),at(j+1),.0013))
racket=mesh('Racket · woven 21 / 23',[tube([0,-.091,0],[0,.079,0],.014,ink,16),tube([0,.08,0],[0,.104,0],.013,lime,16,.004),tube([0,.104,0],[0,center-ry+.005,0],.0034,ink,10),combine_tubes(rim,ink),combine_tubes(rim[10:29]+rim[41:47],lime,8),combine_tubes(strings,string,5),combine_tubes(grip,shoe,5)])
def write(animations):
 for clip in animations:
  time=acc(np.asarray(clip['times'],'f4'),limits=True);anim={'name':clip['id'],'channels':[],'samplers':[]}
  for k,values in clip['tracks'].items():
   node,path=k.split('/');node=racket if node=='racket' else names.index(node)
   arr=np.asarray(values,'f4');mode='rotation' if path=='q' else 'translation'
   s=len(anim['samplers']);anim['samplers'].append({'input':time,'output':acc(arr),'interpolation':'LINEAR'});anim['channels'].append({'sampler':s,'target':{'node':node,'path':mode}})
  g['animations'].append(anim)
 g['buffers']=[{'byteLength':len(binary)}];j=json.dumps(g,separators=(',',':')).encode();j+=b' '*(-len(j)%4);binary.extend(b'\0'*(-len(binary)%4))
 (HERE/'athlete.glb').write_bytes(struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary)
if __name__=='__main__':write(json.loads((HERE.parent/'.cache/court-studio/animation.json').read_text()))
