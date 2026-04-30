"""
Export EUC+rider geometry from MuJoCo scene.xml to STL for OpenFOAM.

Uses MuJoCo forward kinematics so capsule/sphere/box shapes come out
in their correct world-space position and orientation for any joint pose.

Usage:
    python mujoco_to_stl.py --lean 0  --crouch 0   --out baseline/constant/triSurface/
    python mujoco_to_stl.py --lean 20 --crouch 0.5 --out sweep/lean20_c5/constant/triSurface/

Lean:   chassis tilt angle (deg, forward positive)
Crouch: 0=upright, 1=full tuck (maps to hip+knee flexion)
"""

import argparse, math, pathlib, struct
import numpy as np
import mujoco

# Default: look for euc-sim next to euc-anthology, or override via --scene
_HERE = pathlib.Path(__file__).resolve().parent
SCENE_XML = _HERE.parent.parent.parent / 'euc-sim' / 'models' / 'scene.xml'
if not SCENE_XML.exists():
    SCENE_XML = _HERE.parent.parent / 'euc-sim' / 'models' / 'scene.xml'
N_SIDES = 24   # tessellation resolution (24 → smooth enough for snappyHexMesh)


# ---------------------------------------------------------------------------
# Tessellation helpers — all return list of (v0, v1, v2) numpy float arrays
# ---------------------------------------------------------------------------

def _circle_pts(center, ax, ay, r, n):
    """n evenly-spaced points on a circle with local axes ax, ay, radius r."""
    angles = np.linspace(0, 2 * math.pi, n, endpoint=False)
    return [center + r * (math.cos(a) * ax + math.sin(a) * ay) for a in angles]


def tessellate_sphere(center, radius, n=N_SIDES):
    tris = []
    stacks = n // 2
    for i in range(stacks):
        phi0 = math.pi * i / stacks - math.pi / 2
        phi1 = math.pi * (i + 1) / stacks - math.pi / 2
        for j in range(n):
            th0 = 2 * math.pi * j / n
            th1 = 2 * math.pi * (j + 1) / n
            def pt(phi, th):
                return center + radius * np.array([math.cos(phi)*math.cos(th),
                                                   math.cos(phi)*math.sin(th),
                                                   math.sin(phi)])
            p00, p10 = pt(phi0, th0), pt(phi0, th1)
            p01, p11 = pt(phi1, th0), pt(phi1, th1)
            tris.append((p00, p10, p11))
            tris.append((p00, p11, p01))
    return tris


def tessellate_capsule(p1, p2, radius, n=N_SIDES):
    """Capsule = cylinder + two hemispherical caps."""
    axis = p2 - p1
    length = np.linalg.norm(axis)
    if length < 1e-8:
        return tessellate_sphere((p1 + p2) / 2, radius, n)
    zhat = axis / length
    # build orthonormal frame
    perp = np.array([1, 0, 0]) if abs(zhat[0]) < 0.9 else np.array([0, 1, 0])
    xhat = np.cross(zhat, perp); xhat /= np.linalg.norm(xhat)
    yhat = np.cross(zhat, xhat)

    tris = []
    angles = np.linspace(0, 2 * math.pi, n, endpoint=False)
    rim1 = [p1 + radius * (math.cos(a) * xhat + math.sin(a) * yhat) for a in angles]
    rim2 = [p2 + radius * (math.cos(a) * xhat + math.sin(a) * yhat) for a in angles]

    # Cylinder side
    for i in range(n):
        j = (i + 1) % n
        tris.append((rim1[i], rim1[j], rim2[j]))
        tris.append((rim1[i], rim2[j], rim2[i]))

    # Hemisphere caps (stacks)
    stacks = n // 4
    for cap_center, rim, sign in [(p1, rim1, -1), (p2, rim2, 1)]:
        prev_ring = list(rim)
        for s in range(1, stacks + 1):
            phi = sign * math.pi / 2 * s / stacks
            r_ring = radius * math.cos(phi)
            z_off  = sign * radius * math.sin(phi)
            curr_ring = [cap_center + z_off * zhat + r_ring * (math.cos(a) * xhat + math.sin(a) * yhat)
                         for a in angles]
            for i in range(n):
                j = (i + 1) % n
                if s < stacks:
                    tris.append((prev_ring[i], prev_ring[j], curr_ring[j]))
                    tris.append((prev_ring[i], curr_ring[j], curr_ring[i]))
                else:
                    pole = cap_center + sign * radius * zhat
                    tris.append((prev_ring[i], prev_ring[j], pole))
            prev_ring = curr_ring
    return tris


def tessellate_cylinder(center, zhat, radius, half_height, n=N_SIDES):
    perp = np.array([1, 0, 0]) if abs(zhat[0]) < 0.9 else np.array([0, 1, 0])
    xhat = np.cross(zhat, perp); xhat /= np.linalg.norm(xhat)
    yhat = np.cross(zhat, xhat)
    p1 = center - half_height * zhat
    p2 = center + half_height * zhat
    angles = np.linspace(0, 2 * math.pi, n, endpoint=False)
    rim1 = [p1 + radius * (math.cos(a) * xhat + math.sin(a) * yhat) for a in angles]
    rim2 = [p2 + radius * (math.cos(a) * xhat + math.sin(a) * yhat) for a in angles]
    tris = []
    for i in range(n):
        j = (i + 1) % n
        tris.append((rim1[i], rim1[j], rim2[j]))
        tris.append((rim1[i], rim2[j], rim2[i]))
        tris.append((p1, rim1[j], rim1[i]))
        tris.append((p2, rim2[i], rim2[j]))
    return tris


def tessellate_box(center, xmat, half_sizes):
    """xmat: 3×3 rotation matrix (rows = local axes in world frame)."""
    corners = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                corners.append(center + xmat.T @ (half_sizes * np.array([sx, sy, sz])))
    # faces: -x, +x, -y, +y, -z, +z
    face_indices = [
        (0,2,6,4), (1,5,7,3),   # -x +x
        (0,4,5,1), (2,3,7,6),   # -y +y
        (0,1,3,2), (4,6,7,5),   # -z +z
    ]
    tris = []
    for fi in face_indices:
        v = [corners[i] for i in fi]
        tris.append((v[0], v[1], v[2]))
        tris.append((v[0], v[2], v[3]))
    return tris


# ---------------------------------------------------------------------------
# MuJoCo → STL
# ---------------------------------------------------------------------------

# Geoms to skip (ground plane, internal contact bodies)
SKIP_GEOM_NAMES = {'ground'}

def geoms_to_triangles(model, data):
    """Iterate all geoms and tessellate into world-space triangles."""
    tris = []
    for gi in range(model.ngeom):
        name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM, gi) or ''
        if name in SKIP_GEOM_NAMES:
            continue
        gtype = model.geom_type[gi]
        size  = model.geom_size[gi]
        pos   = data.geom_xpos[gi].copy()
        xmat  = data.geom_xmat[gi].reshape(3, 3).copy()

        if gtype == mujoco.mjtGeom.mjGEOM_SPHERE:
            tris += tessellate_sphere(pos, size[0])

        elif gtype == mujoco.mjtGeom.mjGEOM_CAPSULE:
            # MuJoCo capsule: size[0]=radius, size[1]=half-length
            zhat = xmat[:, 2]
            p1 = pos - size[1] * zhat
            p2 = pos + size[1] * zhat
            tris += tessellate_capsule(p1, p2, size[0])

        elif gtype == mujoco.mjtGeom.mjGEOM_CYLINDER:
            # size[0]=radius, size[1]=half-height, axis=local Z
            zhat = xmat[:, 2]
            tris += tessellate_cylinder(pos, zhat, size[0], size[1])

        elif gtype == mujoco.mjtGeom.mjGEOM_BOX:
            tris += tessellate_box(pos, xmat, size)

        elif gtype == mujoco.mjtGeom.mjGEOM_PLANE:
            pass  # skip infinite plane

    return tris


def write_stl_binary(path, tris):
    """Binary STL — much smaller than ASCII for large meshes."""
    with open(path, 'wb') as f:
        f.write(b'\x00' * 80)           # header
        f.write(struct.pack('<I', len(tris)))
        for v0, v1, v2 in tris:
            n = np.cross(v1 - v0, v2 - v0)
            nn = np.linalg.norm(n)
            n = n / nn if nn > 1e-10 else np.zeros(3)
            f.write(struct.pack('<3f', *n))
            f.write(struct.pack('<3f', *v0))
            f.write(struct.pack('<3f', *v1))
            f.write(struct.pack('<3f', *v2))
            f.write(b'\x00\x00')        # attribute byte count


# ---------------------------------------------------------------------------
# Pose mapping: (lean_deg, crouch_factor) → joint angles (radians)
# ---------------------------------------------------------------------------

def pose_joints(lean_deg, crouch_factor):
    """
    Map high-level (lean, crouch) parameters to MuJoCo joint qpos values.

    Joint order in qpos (after the 2 free DOFs of slide_x and tilt):
      slide_x  (index 0) — position along X, set to 0
      tilt     (index 1) — chassis lean, set to lean_deg
      wheel_spin (2)     — irrelevant for aero
      ankle    (3)
      knee     (4)
      hip      (5)
      shoulder_L (6)
      shoulder_R (7)
    """
    lean_rad   = math.radians(lean_deg)
    # Crouch: hip flexion 0→40°, knee flexion 0→35°, ankle adjustment
    hip_flex   = math.radians(crouch_factor * 40)
    knee_flex  = math.radians(crouch_factor * 35)
    ankle_adj  = math.radians(crouch_factor * -10)
    # Shoulder: arms forward as rider tucks
    shoulder   = math.radians(-30 - crouch_factor * 50)

    return {
        'slide_x':    0.0,
        'tilt':       lean_rad,
        'wheel_spin': 0.0,
        'ankle':      ankle_adj,
        'knee':       -knee_flex,
        'hip':        hip_flex,
        'shoulder_L': shoulder,
        'shoulder_R': shoulder,
    }


def set_pose(model, data, lean_deg, crouch_factor):
    joints = pose_joints(lean_deg, crouch_factor)
    for name, val in joints.items():
        jid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)
        if jid >= 0:
            addr = model.jnt_qposadr[jid]
            data.qpos[addr] = val
    mujoco.mj_kinematics(model, data)
    mujoco.mj_comPos(model, data)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lean',   type=float, default=0,   help='Chassis lean deg (forward)')
    ap.add_argument('--crouch', type=float, default=0,   help='Crouch factor 0-1')
    ap.add_argument('--scene',  type=str,   default=str(SCENE_XML))
    ap.add_argument('--out',    type=str,   default='.')
    args = ap.parse_args()

    model = mujoco.MjModel.from_xml_path(args.scene)
    data  = mujoco.MjData(model)
    mujoco.mj_resetData(model, data)

    set_pose(model, data, args.lean, args.crouch)

    tris = geoms_to_triangles(model, data)
    print(f"Triangles: {len(tris)}")

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    name    = f"rider_lean{int(args.lean)}_crouch{int(args.crouch*10)}"
    stl_path = out_dir / f"{name}.stl"
    write_stl_binary(stl_path, tris)
    print(f"Written → {stl_path}  ({stl_path.stat().st_size // 1024} KB)")

    all_v = np.array([[v for v in tri] for tri in tris]).reshape(-1, 3)
    print(f"Bounds X: [{all_v[:,0].min():.3f}, {all_v[:,0].max():.3f}]")
    print(f"Bounds Y: [{all_v[:,1].min():.3f}, {all_v[:,1].max():.3f}]")
    print(f"Bounds Z: [{all_v[:,2].min():.3f}, {all_v[:,2].max():.3f}]")

if __name__ == '__main__':
    main()
