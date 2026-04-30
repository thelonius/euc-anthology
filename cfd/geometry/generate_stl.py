"""
Generate simplified EUC+rider 2-D extrusion STL for OpenFOAM snappyHexMesh.

Each body segment is approximated as a cylinder (circle extruded 0.1 m in z).
Coordinates match src/logic/aero.js riderCylinders() exactly.

Usage:
    python generate_stl.py --lean 0 --crouch 0 --height 1.75 --out cases/baseline/constant/triSurface/
    python generate_stl.py --lean 20 --crouch 0.5 --out cases/parametric/lean20_crouch05/constant/triSurface/
"""
import argparse, math, pathlib

# ---- rider geometry (mirrors aero.js riderCylinders) ----------------------

def lerp(a, b, t):
    return [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t]

def rider_cylinders(lean_deg=0, crouch_factor=0, height_m=1.75):
    theta = math.radians(lean_deg)
    scale = height_m / 1.75
    crouch_flex = crouch_factor * 0.28

    shin_l  = 0.43 * scale
    thigh_l = 0.41 * scale
    torso_l = 0.52 * scale

    ankle = [0, 0.344 * scale]
    knee  = [ankle[0] + shin_l  * math.sin(theta),
             ankle[1] + shin_l  * math.cos(theta)]
    hip   = [knee[0]  + thigh_l * math.sin(theta + 0.04),
             knee[1]  + thigh_l * math.cos(theta + 0.04)]
    torso_angle = theta * 0.52 + crouch_flex
    shoulder = [hip[0] + torso_l * math.sin(torso_angle),
                hip[1] + torso_l * math.cos(torso_angle)]
    head_angle = torso_angle * 0.62
    head_c = [shoulder[0] + 0.17 * scale * math.sin(head_angle),
              shoulder[1] + 0.17 * scale * math.cos(head_angle)]
    arm_ang = torso_angle + 1.25 + crouch_factor * 0.5
    elbow_c = [shoulder[0] + 0.29 * scale * math.sin(arm_ang),
               shoulder[1] - 0.29 * scale * math.cos(arm_ang) * 0.55]

    s = 0.95 * scale
    cyls = [
        dict(x=0,          y=0.254,                          r=0.254,     label='wheel'),
        dict(x=0.07,       y=0.44,                           r=0.09*s,    label='shell'),
        dict(x=ankle[0]+0.06, y=ankle[1]-0.02,              r=0.043*s,   label='foot'),
        dict(x=lerp(ankle,knee,0.32)[0], y=lerp(ankle,knee,0.32)[1], r=0.051*s, label='shin1'),
        dict(x=lerp(ankle,knee,0.70)[0], y=lerp(ankle,knee,0.70)[1], r=0.057*s, label='shin2'),
        dict(x=knee[0],    y=knee[1],                        r=0.063*s,   label='knee'),
        dict(x=lerp(knee,hip,0.38)[0], y=lerp(knee,hip,0.38)[1], r=0.071*s, label='thigh1'),
        dict(x=lerp(knee,hip,0.74)[0], y=lerp(knee,hip,0.74)[1], r=0.074*s, label='thigh2'),
        dict(x=hip[0],     y=hip[1],                         r=0.115*s,   label='hip'),
        dict(x=lerp(hip,shoulder,0.34)[0], y=lerp(hip,shoulder,0.34)[1], r=0.126*s, label='torso1'),
        dict(x=lerp(hip,shoulder,0.70)[0], y=lerp(hip,shoulder,0.70)[1], r=0.112*s, label='torso2'),
        dict(x=shoulder[0], y=shoulder[1],                   r=0.096*s,   label='shoulder'),
        dict(x=head_c[0],   y=head_c[1],                     r=0.099*s,   label='head'),
        dict(x=elbow_c[0],  y=elbow_c[1],                    r=0.037*s,   label='elbow'),
    ]
    return cyls

# ---- STL cylinder (extruded circle, 0.1 m in z) ---------------------------

def cylinder_triangles(cx, cy, r, z0=0, z1=0.1, n_sides=32):
    """Return list of (v0, v1, v2, normal) tuples for a closed cylinder."""
    tris = []
    angles = [2*math.pi*i/n_sides for i in range(n_sides)]
    pts = [(cx + r*math.cos(a), cy + r*math.sin(a)) for a in angles]

    for i in range(n_sides):
        j = (i+1) % n_sides
        # side quad → 2 triangles, outward normal
        p00 = (pts[i][0], pts[i][1], z0)
        p10 = (pts[j][0], pts[j][1], z0)
        p01 = (pts[i][0], pts[i][1], z1)
        p11 = (pts[j][0], pts[j][1], z1)
        # normal = outward radial at midpoint of edge
        mx = (pts[i][0]+pts[j][0])/2 - cx
        my = (pts[i][1]+pts[j][1])/2 - cy
        mg = math.hypot(mx, my)
        n = (mx/mg, my/mg, 0)
        tris.append((p00, p10, p11, n))
        tris.append((p00, p11, p01, n))

    # cap z0 (normal -z), z1 (normal +z)
    c0 = (cx, cy, z0)
    c1 = (cx, cy, z1)
    for i in range(n_sides):
        j = (i+1) % n_sides
        tris.append(((pts[j][0], pts[j][1], z0), (pts[i][0], pts[i][1], z0), c0, (0,0,-1)))
        tris.append(((pts[i][0], pts[i][1], z1), (pts[j][0], pts[j][1], z1), c1, (0,0, 1)))
    return tris

def write_stl(path, name, all_tris):
    """Write ASCII STL."""
    with open(path, 'w') as f:
        f.write(f"solid {name}\n")
        for v0, v1, v2, n in all_tris:
            f.write(f"  facet normal {n[0]:.6f} {n[1]:.6f} {n[2]:.6f}\n")
            f.write(f"    outer loop\n")
            f.write(f"      vertex {v0[0]:.6f} {v0[1]:.6f} {v0[2]:.6f}\n")
            f.write(f"      vertex {v1[0]:.6f} {v1[1]:.6f} {v1[2]:.6f}\n")
            f.write(f"      vertex {v2[0]:.6f} {v2[1]:.6f} {v2[2]:.6f}\n")
            f.write(f"    endloop\n")
            f.write(f"  endfacet\n")
        f.write(f"endsolid {name}\n")

# ---- main -----------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lean',   type=float, default=0)
    ap.add_argument('--crouch', type=float, default=0)
    ap.add_argument('--height', type=float, default=1.75)
    ap.add_argument('--out',    type=str,   default='.')
    args = ap.parse_args()

    cyls = rider_cylinders(args.lean, args.crouch, args.height)

    all_tris = []
    for c in cyls:
        all_tris.extend(cylinder_triangles(c['x'], c['y'], c['r']))

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    name = f"rider_lean{int(args.lean)}_crouch{int(args.crouch*10)}"
    stl_path = out_dir / f"{name}.stl"
    write_stl(stl_path, name, all_tris)
    print(f"Written {len(all_tris)} triangles → {stl_path}")

    # Print bounding box for sanity check
    all_verts = [(v[0], v[1]) for tri in all_tris for v in tri[:3]]
    xs = [v[0] for v in all_verts]
    ys = [v[1] for v in all_verts]
    print(f"Bounding box: x=[{min(xs):.3f}, {max(xs):.3f}]  y=[{min(ys):.3f}, {max(ys):.3f}]")
    print(f"Approx frontal area: {(max(xs)-min(xs)) * (max(ys)-min(ys)):.3f} m²")

if __name__ == '__main__':
    main()
