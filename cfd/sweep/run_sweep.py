"""
Parametric sweep driver: iterates lean × crouch × speed combinations,
generates geometry, patches boundary conditions, runs simpleFoam, extracts Cd.

Usage (local):
    python run_sweep.py --config sweep_config.yaml --jobs 4

Usage (K8s/OpenStack — batch mode, single case per pod):
    python run_sweep.py --case-index 7   # pod env: CASE_INDEX=7
"""
import argparse, os, shutil, subprocess, csv, math, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / 'geometry'))
import mujoco_to_stl as geom
import yaml

RHO = 1.225

def build_cases(cfg):
    cases = []
    for speed in cfg['speeds_kmh']:
        for lean in cfg['lean_deg']:
            for crouch in cfg['crouch']:
                for h in cfg['rider_heights']:
                    cases.append(dict(speed_kmh=speed, lean=lean, crouch=crouch, height=h))
    return cases

def patch_u_field(case_dir, speed_ms):
    u_file = case_dir / '0' / 'U'
    txt = u_file.read_text()
    import re
    txt = re.sub(r'uniform \([\d.]+ 0 0\)',
                 f'uniform ({speed_ms:.4f} 0 0)', txt)
    u_file.write_text(txt)

def run_openfoam(case_dir, ncpu=4):
    env = os.environ.copy()
    def run(cmd):
        r = subprocess.run(cmd, cwd=case_dir, env=env, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stderr[-2000:])
            raise RuntimeError(f"{cmd[0]} failed in {case_dir}")

    run(['blockMesh'])
    # Copy STL to triSurface before snappy
    ts_dir = case_dir / 'constant' / 'triSurface'
    ts_dir.mkdir(exist_ok=True)
    stl_src = case_dir / 'geometry' / f"{case_dir.name}.stl"
    if stl_src.exists():
        shutil.copy(stl_src, ts_dir / 'rider.stl')
        run(['snappyHexMesh', '-overwrite'])
    else:
        print(f"  no STL, skipping snappy (blockMesh-only domain)")
    run(['simpleFoam'])

def extract_cd(case_dir):
    """Parse last forceCoeffs entry from postProcessing."""
    fc_dir = case_dir / 'postProcessing' / 'forceCoeffs'
    if not fc_dir.exists():
        return None, None
    dirs = sorted(fc_dir.iterdir())
    if not dirs:
        return None, None
    coeff_file = dirs[-1] / 'forceCoeffs.dat'
    if not coeff_file.exists():
        coeff_file = dirs[-1] / 'coefficient.dat'
    if not coeff_file.exists():
        return None, None
    last = None
    for line in coeff_file.read_text().splitlines():
        if not line.startswith('#') and line.strip():
            last = line.split()
    if last is None or len(last) < 3:
        return None, None
    Cd = float(last[1])
    Cl = float(last[2])
    return Cd, Cl

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', default='sweep_config.yaml')
    ap.add_argument('--jobs',   type=int, default=1)
    ap.add_argument('--case-index', type=int, default=None,
                    help='Run only this case index (for K8s job array)')
    ap.add_argument('--base-case', default='../cases/baseline',
                    help='Template case directory')
    ap.add_argument('--out-dir', default='/results/euc_sweep')
    ap.add_argument('--ncpu', type=int, default=4)
    args = ap.parse_args()

    # K8s: CASE_INDEX env overrides
    idx_env = os.environ.get('CASE_INDEX')
    if idx_env is not None:
        args.case_index = int(idx_env)

    cfg = yaml.safe_load(open(args.config))
    cases = build_cases(cfg)
    print(f"Total cases: {len(cases)}")

    run_indices = ([args.case_index] if args.case_index is not None
                   else list(range(len(cases))))

    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    results_csv = out_dir / 'results.csv'
    is_new = not results_csv.exists()
    csv_f = open(results_csv, 'a', newline='')
    writer = csv.DictWriter(csv_f, fieldnames=['idx','speed_kmh','lean','crouch','height','Cd','Cl','CdA'])
    if is_new:
        writer.writeheader()

    base_case = pathlib.Path(args.base_case).resolve()

    for i in run_indices:
        c = cases[i]
        case_name = f"case_{i:03d}_s{int(c['speed_kmh'])}_l{int(c['lean'])}_c{int(c['crouch']*10)}"
        case_dir = out_dir / case_name
        print(f"\n[{i}/{len(cases)-1}] {case_name}")

        # Clone template
        if case_dir.exists():
            shutil.rmtree(case_dir)
        shutil.copytree(base_case, case_dir)

        # Generate STL from MuJoCo forward kinematics
        ts_dir = case_dir / 'constant' / 'triSurface'
        ts_dir.mkdir(exist_ok=True)
        import mujoco as mj
        scene = str(geom.SCENE_XML)
        model = mj.MjModel.from_xml_path(scene)
        data  = mj.MjData(model)
        mj.mj_resetData(model, data)
        geom.set_pose(model, data, c['lean'], c['crouch'])
        tris = geom.geoms_to_triangles(model, data)
        stl_path = ts_dir / 'rider.stl'
        geom.write_stl_binary(stl_path, tris)
        print(f"  STL: {len(tris)} tris → {stl_path}")

        # Patch speed in boundary conditions
        speed_ms = c['speed_kmh'] / 3.6
        patch_u_field(case_dir, speed_ms)

        # Run OpenFOAM
        run_openfoam(case_dir, ncpu=args.ncpu)

        # Extract results
        Cd, Cl = extract_cd(case_dir)
        # CdA = Cd × Aref (Aref = 0.50 m² per controlDict)
        CdA = Cd * 0.50 if Cd is not None else None
        print(f"  Cd={Cd:.4f}  Cl={Cl:.4f}  CdA={CdA:.4f}" if Cd else "  no result")
        writer.writerow(dict(idx=i, **c, Cd=Cd, Cl=Cl, CdA=CdA))
        csv_f.flush()

    csv_f.close()
    print(f"\nDone. Results: {results_csv}")

if __name__ == '__main__':
    main()
