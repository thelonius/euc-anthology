#!/bin/bash
# Quick local run — single case inside Docker (no K8s needed)
# Prerequisites: Docker installed, run from repo root
#
# Usage:
#   bash cfd/deploy/run_local.sh                   # upright, 60 km/h
#   LEAN=20 CROUCH=0.5 SPEED=80 bash cfd/deploy/run_local.sh

set -euo pipefail
cd "$(dirname "$0")/../.."

LEAN=${LEAN:-0}
CROUCH=${CROUCH:-0}
SPEED=${SPEED:-60}
RESULTS_DIR=$(pwd)/results/cfd

mkdir -p "$RESULTS_DIR"

# Generate STL for this posture
python3 cfd/geometry/generate_stl.py \
  --lean "$LEAN" --crouch "$CROUCH" \
  --out /tmp/euc_stl/

docker run --rm \
  -v "$(pwd):/opt/euc-cfd:ro" \
  -v "/tmp/euc_stl:/opt/stl:ro" \
  -v "$RESULTS_DIR:/results" \
  openfoam/openfoam11-default:latest \
  /bin/bash -c "
    . /opt/openfoam11/etc/bashrc
    cp -r /opt/euc-cfd/cfd/cases/baseline /tmp/case
    cp /opt/stl/*.stl /tmp/case/constant/triSurface/ 2>/dev/null || true
    cd /tmp/case
    blockMesh
    [ -f constant/triSurface/*.stl ] && snappyHexMesh -overwrite || echo 'no STL, skipping snappy'
    simpleFoam 2>&1 | tail -20
    postProcess -func forceCoeffs
    cp -r postProcessing /results/
    echo '--- DONE ---'
    grep -h Cd postProcessing/forceCoeffs/*/forceCoeffs.dat 2>/dev/null | tail -3 || true
  "

echo "Results in $RESULTS_DIR"
