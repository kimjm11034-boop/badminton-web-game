"""Prepare an editable Blender project with synchronized racket + body Actions and timeline markers."""
from pathlib import Path
import bpy,json,math
from mathutils import Vector
studio=Path(__file__).resolve().parents[1];catalog=json.loads((studio/'catalog.json').read_text(encoding='utf8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.fps=60;scene.render.fps_base=1
bpy.ops.import_scene.gltf(filepath=str(studio/'athlete.glb'))
actors=[o for o in scene.objects if o.animation_data and o.animation_data.nla_tracks]
assert len(actors)==2
slots={}
for obj in actors:
 ad=obj.animation_data;slots[obj.name]={t.name:t.strips[0].action_slot for t in ad.nla_tracks}
 ad.action=None
 for t in list(ad.nla_tracks):ad.nla_tracks.remove(t)
 ad.nla_tracks.new().name='경기 모션 · 67개 연속'
items=list(catalog);first=next(c for c in items if c['id']=='capture-clear-1');items.remove(first);items.insert(0,first)
frame=1
for item in items:
 action=bpy.data.actions[item['id']];action.use_fake_user=True;action.asset_mark();action.asset_data.description=item['name']+' / '+item['source']
 action.asset_data.tags.new(item['family'])
 for obj in actors:
  strip=obj.animation_data.nla_tracks[0].strips.new(item['id'],frame,action)
  strip.action_slot=slots[obj.name][item['id']];strip.extrapolation='NOTHING';strip.blend_type='REPLACE'
  strip.name=item['name'];strip.use_auto_blend=False
 scene.timeline_markers.new(item['name'],frame=frame);frame+=math.ceil(action.frame_range[1]-action.frame_range[0])+5
scene.frame_start=1;scene.frame_end=frame-5;scene.frame_set(1+round(first['duration']*first['contact']*60))
# Court stage kept in its own collection so animators can isolate/export the athlete.
stage=bpy.data.collections.new('Court • studio');scene.collection.children.link(stage)
def move(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 stage.objects.link(o);return o
def material(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.73;return m
def slab(n,loc,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=move(bpy.context.object);o.name=n;o.dimensions=scale;o.data.materials.append(mat);return o
court=material('Court surface',(.035,.16,.145));line=material('Chalk white',(.74,.81,.69));border=material('Hall surrounds',(.048,.085,.080))
slab('Court platform',(0,-3.2,-.044),(9,17,.08),court);slab('Hall floor',(0,0,-.12),(100,100,.12),border)
for x in [-3.05,-2.59,2.59,3.05]:slab('Sideline',(x,-3.2,-.002),(.035,13.40,.004),line)
for z in [-6.7,-5.94,-1.98,1.98,5.94,6.7]:slab('Service / baseline',(0,-3.2-z,-.002),(6.10,.035,.004),line)
def aim(o,point):o.rotation_euler=(Vector(point)-o.location).to_track_quat('-Z','Y').to_euler()
def area(n,loc,energy,col,size):
 d=bpy.data.lights.new(n,'AREA');d.energy=energy;d.color=col;d.shape='DISK';d.size=size;o=bpy.data.objects.new(n,d);stage.objects.link(o);o.location=loc;aim(o,(0,0,1.15))
area('Softbox • key',(2.7,-3.5,4.7),440,(1,.90,.80),3.2);area('Softbox • fill',(-3,-1.4,2.9),240,(.73,.86,1),3);area('Softbox • rim',(-1,3.6,3.6),570,(.88,1,.98),2.8)
world=bpy.data.worlds.new('Indoor daylight');world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.32,.40,.39,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.46;scene.world=world
cam=bpy.data.cameras.new('Portrait camera');cam.lens=56;o=bpy.data.objects.new('Portrait camera',cam);stage.objects.link(o);o.location=(2.45,-4.35,1.79);aim(o,(0,0,1.30));scene.camera=o
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1024;scene.render.resolution_y=1024;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False;scene.render.filepath='//evidence/blender-clear.png'
for obj in bpy.context.selected_objects:obj.select_set(False)
arm=next(o for o in actors if o.type=='ARMATURE');bpy.context.view_layer.objects.active=arm
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   sp=area.spaces.active;sp.overlay.show_overlays=False;sp.shading.type='MATERIAL';rv=sp.region_3d;rv.view_rotation=o.rotation_euler.to_quaternion();rv.view_distance=4.8;rv.view_location=(0,0,1.21)
notes=bpy.data.texts.new('사용 안내');notes.write('타임라인 마커에 67개 모션의 시작점이 있습니다. 각 구간의 몸과 라켓은 같은 Action의 두 슬롯을 사용합니다. Action Editor에서 키를 수정할 수 있습니다. 센서 실측 / 경기 영상 추정 / 원본 사진 보간 / 제작 동작의 구분은 catalog.json과 SOURCES.md에 있습니다.')
bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(studio/'Astra-Court.blend'),compress=True)
bpy.ops.render.render(write_still=True)
print('Saved',len(bpy.data.actions),'Actions,',len(scene.timeline_markers),'markers, frame',scene.frame_current)
