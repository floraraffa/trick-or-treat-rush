# Builds the game's moves as a Humanoid FBX (tools/quest/clips-fbx.mjs writes the poses as JSON first):
#   blender --background --factory-startup --python tools/quest/blender/clips.py -- clips.json out.fbx
# An armature in the poses' T-pose (character space: Y up, facing +Z, its left on +X; in Blender Z up, facing -Y),
# one action per clip, every joint keyed every frame (the hips' height too), exported as FBX for Unity
# (Y up, -Z forward, one take per action).
import json
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

args = sys.argv[sys.argv.index("--") + 1:]
data = json.load(open(args[0]))
out = args[1]
H = data["hipHeight"]


def c2b(v):
    """Character space (Y up, facing +Z, left on +X) → Blender (Z up, facing -Y, left on +X)."""
    return Vector((v[0], -v[2], v[1]))


def q2b(q):
    """A turn [x, y, z, w] in character space → the same turn in Blender's axes."""
    x, y, z, w = q
    return Quaternion((w, x, -z, y))


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
arm = bpy.data.armatures.new("TrickOrTreatRig")
rig = bpy.data.objects.new("TrickOrTreatRig", arm)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)

names, parent, rest = data["joints"], data["parent"], data["rest"]
children = {i: [k for k, p in enumerate(parent) if p == i] for i in range(len(names))}
bpy.ops.object.mode_set(mode="EDIT")
for i, n in enumerate(names):
    eb = arm.edit_bones.new(n)
    eb.head = c2b(rest[i]) * H
for i, n in enumerate(names):
    eb = arm.edit_bones[n]
    kids = [k for k in children[i] if not names[k].startswith(("Left", "Right")) or names[i].startswith(("Left", "Right"))]
    if kids:  # towards its (first) child along the chain
        eb.tail = arm.edit_bones[names[kids[0]]].head.copy()
    elif parent[i] >= 0:  # a hand, a toe, the head: on along the way it was going
        d = eb.head - arm.edit_bones[names[parent[i]]].head
        eb.tail = eb.head + (d.normalized() * 0.08 if d.length > 1e-6 else Vector((0, 0, 0.08)))
    if names[i] == "Head":
        eb.tail = eb.head + Vector((0, 0, 0.2 * H))
    if (eb.tail - eb.head).length < 1e-4:
        eb.tail = eb.head + Vector((0, 0, 0.05))
    if parent[i] >= 0:
        eb.parent = arm.edit_bones[names[parent[i]]]
        eb.use_connect = False
bpy.ops.object.mode_set(mode="POSE")

rest_m = {n: arm.bones[n].matrix_local.copy() for n in names}  # armature space, at rest
rest_rot = {n: rest_m[n].to_quaternion() for n in names}
for pb in rig.pose.bones:
    pb.rotation_mode = "QUATERNION"

rig.animation_data_create()
for clip in data["clips"]:
    act = bpy.data.actions.new(clip["name"])
    act.use_fake_user = True
    rig.animation_data.action = act
    for f, frame in enumerate(clip["frames"]):
        pose = {}
        for i, n in enumerate(names):
            rot = q2b(frame["q"][i]) @ rest_rot[n]
            if parent[i] < 0:
                head = c2b(frame["hips"]) * H
            else:
                p = names[parent[i]]
                off = rest_m[n].translation - rest_m[p].translation
                head = pose[p].translation + (q2b(frame["q"][parent[i]]).to_matrix() @ off)
            pose[n] = Matrix.Translation(head) @ rot.to_matrix().to_4x4()
        for i, n in enumerate(names):
            pb = rig.pose.bones[n]
            if parent[i] < 0:
                basis = rest_m[n].inverted() @ pose[n]
            else:
                p = names[parent[i]]
                basis = (rest_m[p].inverted() @ rest_m[n]).inverted() @ pose[p].inverted() @ pose[n]
            loc, q, _ = basis.decompose()
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=f + 1)
            if parent[i] < 0:
                pb.location = loc
                pb.keyframe_insert("location", frame=f + 1)
    act.frame_range = (1, len(clip["frames"]))
    print(f"✔ {clip['name']}: {len(clip['frames'])} frames at {clip['fps']} fps")

# Back to rest for the bind pose (a T-pose: what Unity's Humanoid set-up wants).
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.rotation_quaternion = Quaternion()
    pb.location = Vector()
scene.render.fps = 30
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.export_scene.fbx(
    filepath=out, use_selection=False, object_types={"ARMATURE"}, add_leaf_bones=False,
    bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
    bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0,
    axis_forward="-Z", axis_up="Y", apply_scale_options="FBX_SCALE_ALL", armature_nodetype="NULL",
)
print(f"✔ wrote {out}: {len(names)} joints, {len(data['clips'])} clips")
