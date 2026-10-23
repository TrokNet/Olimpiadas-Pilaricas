import bpy,bmesh,sys,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tmp/prepared-models';OUT.mkdir(parents=True,exist_ok=True)
for key in ['trophy','football','basketball','volleyball']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/f'assets/source-models/{key}.glb'))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 if key=='trophy':
  for o in objects:
   o.rotation_mode='XYZ';o.rotation_euler.z+=math.pi/2
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 lo=Vector((min((o.matrix_world@Vector(c))[a] for o in objects for c in o.bound_box) for a in range(3)))
 hi=Vector((max((o.matrix_world@Vector(c))[a] for o in objects for c in o.bound_box) for a in range(3)))
 center=(lo+hi)/2;factor=(2.7/(hi.z-lo.z)) if key=='trophy' else 2/max(hi-lo)
 for obj in objects:
  for v in obj.data.vertices:
   v.co=(v.co-center)*factor
   if key=='trophy':v.co.z+=1.35
  obj.name=f'{key}-body'
  # Preserve the artist silhouette; soften sharp manufactured edges only on the cup.
  if key=='trophy':
   bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bmesh.ops.join_triangles(bm,faces=list(bm.faces),angle_face_threshold=.1,angle_shape_threshold=.7);bm.to_mesh(obj.data);bm.free()
   subdiv=obj.modifiers.new('Surface refinement','SUBSURF');subdiv.levels=2;subdiv.render_levels=2
  for poly in obj.data.polygons:poly.use_smooth=True
  if key!='trophy':
   for uv in obj.data.uv_layers.active.data:uv.uv*=4
 for i,mat in enumerate(bpy.data.materials):
  if not mat.use_nodes:continue
  bs=mat.node_tree.nodes.get('Principled BSDF')
  if not bs:continue
  if key=='trophy':
   gold=bs.inputs['Base Color'].default_value[0]>.5
   bs.inputs['Base Color'].default_value=(.83,.53,.16,1) if gold else (.018,.021,.028,1)
   bs.inputs['Metallic'].default_value=.88 if gold else .12
   bs.inputs['Roughness'].default_value=.24 if gold else .3
   mat.name='Champagne gold' if gold else 'Obsidian base'
  else:
   bs.inputs['Roughness'].default_value=.6
   bs.inputs['Metallic'].default_value=0
   bs.inputs['Specular IOR Level'].default_value=.32
   # Fine photographic leather normal; existing sculpted seams remain intact.
   if max(bs.inputs['Base Color'].default_value[:3])>.02:
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'assets/source-textures/leather_white_nor_gl.png'),check_existing=True);tex.image.colorspace_settings.name='Non-Color'
    uv=nodes.new('ShaderNodeTexCoord');links.new(uv.outputs['UV'],tex.inputs['Vector'])
    normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.22 if key=='basketball' else .12
    links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{key}.glb'),export_format='GLB',export_apply=True,export_yup=True,export_extras=False)
 print('PREPARED',key,flush=True)
