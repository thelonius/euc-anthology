# OpenFOAM 11 + Python sweep driver
# Build:  docker build -t euc-cfd:latest .
# Run:    docker run --rm -v /data/results:/results euc-cfd:latest
FROM openfoam/openfoam11-default:latest

# Python deps
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-numpy && \
    rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir pyyaml

# Copy project
COPY ../  /opt/euc-cfd/
WORKDIR /opt/euc-cfd/cfd/sweep

# Source OF env on every bash invocation
RUN echo '. /opt/openfoam11/etc/bashrc' >> /root/.bashrc

ENTRYPOINT ["/bin/bash", "-c", ". /opt/openfoam11/etc/bashrc && python3 run_sweep.py \"$@\"", "--"]
CMD ["--config", "sweep_config.yaml", "--ncpu", "8"]
