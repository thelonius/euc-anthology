#!/bin/bash
# Provision a single OpenStack Nova VM for interactive CFD work
# (use this for exploratory runs before committing to the K8s sweep)
#
# Requires: openstack CLI + credentials sourced (openrc.sh)
# Usage:  source openrc.sh && bash openstack_vm.sh

set -euo pipefail

INSTANCE_NAME="euc-cfd-worker"
FLAVOR="c8r32"           # 8 vCPU, 32 GB RAM — adjust to your cloud flavor list
IMAGE="Ubuntu-22.04-LTS" # base image; we install Docker + OF on first boot
KEY_NAME="your-keypair"  # replace with your key name
NETWORK="your-network"   # replace with your private network name
SECURITY_GROUP="default"
VOLUME_SIZE=100          # GB for results storage

# ---- create instance -------------------------------------------------------
echo "Creating Nova instance $INSTANCE_NAME ..."
openstack server create \
  --flavor     "$FLAVOR" \
  --image      "$IMAGE" \
  --key-name   "$KEY_NAME" \
  --network    "$NETWORK" \
  --security-group "$SECURITY_GROUP" \
  --wait \
  "$INSTANCE_NAME"

INSTANCE_IP=$(openstack server show "$INSTANCE_NAME" -f value -c addresses | grep -oP '\d+\.\d+\.\d+\.\d+' | tail -1)
echo "Instance IP: $INSTANCE_IP"

# ---- bootstrap via SSH (first boot, ~5 min) --------------------------------
ssh -o StrictHostKeyChecking=no ubuntu@"$INSTANCE_IP" bash <<'BOOTSTRAP'
set -e
sudo apt-get update
sudo apt-get install -y docker.io python3-pip git
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
# Pull OpenFOAM image
sudo docker pull openfoam/openfoam11-default:latest
# Install Python deps for sweep driver
pip3 install pyyaml numpy
echo "Bootstrap done"
BOOTSTRAP

echo ""
echo "VM ready. Next steps:"
echo "  1. scp or git-clone euc-anthology to ubuntu@$INSTANCE_IP:~/euc-anthology"
echo "  2. ssh ubuntu@$INSTANCE_IP"
echo "  3. cd euc-anthology/cfd"
echo "  4. bash run_local.sh    # runs sweep inside docker"
