import bpy,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
# Independent CLI preview of the actual imported models and studio HDRI.
layout={'trophy':((0,0,-1.05),1),'football':((-1.65,-.35,-.45),.62),'basketball':((1.7,-.05,-.3),.64),'volleyball':((1.15,.65,1.45),.48)}
for key,(pos,scale) in layout.items():
 bpy.ops.import_scene.gltf(filepath=str(ROOT/f'public/models/{key}.glb'))
 obs=list(bpy.context.selected_objects)
 for o in obs:o.location+=Vector(pos);o.scale*=scale
world=bpy.data.worlds.new('Studio');bpy.context.scene.world=world;world.use_nodes=True
nodes=world.node_tree.nodes;env=nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(ROOT/'public/environments/studio_small_09_1k.hdr'));world.node_tree.links.new(env.outputs['Color'],nodes['Background'].inputs['Color']);nodes['Background'].inputs['Strength'].default_value=.7
for loc,power,color,size in [((0,-4,5),500,(1,.91,.83),5),((-4,-1,2),250,(1,.35,.28),4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.color=color;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,.4))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-8,2));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='PERSP';camera.data.lens=45;bpy.context.scene.camera=camera
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True;s.render.resolution_x=1000;s.render.resolution_y=750;s.render.resolution_percentage=100;s.render.film_transparent=True;s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.filepath=str(ROOT/'tmp/models-review.png');bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tmp/studio-review.blend'));bpy.ops.render.render(write_still=True)
