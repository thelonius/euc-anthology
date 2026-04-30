"""
Train a neural surrogate: (lean, crouch, speed_ms) → (Cd, CdA)
Input:  /results/euc_sweep/results.csv  (from run_sweep.py)
Output: surrogate.onnx  (loaded in browser via onnxruntime-web)

Architecture: 3-input MLP, 2 hidden layers × 32 neurons, tanh activations.
Tiny enough to inline as base64 in the JS bundle (~20 KB).

Usage:
    python train_surrogate.py --csv /results/euc_sweep/results.csv
"""
import argparse, pathlib, sys
import numpy as np

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv', required=True)
    ap.add_argument('--out', default='surrogate.onnx')
    ap.add_argument('--epochs', type=int, default=2000)
    args = ap.parse_args()

    try:
        import torch
        import torch.nn as nn
        import onnx, onnxruntime
    except ImportError:
        print("Install: pip install torch onnx onnxruntime")
        sys.exit(1)

    # ---- load data ---------------------------------------------------------
    import csv
    rows = []
    with open(args.csv) as f:
        for row in csv.DictReader(f):
            if row['Cd'] and row['Cd'] != 'None':
                rows.append([float(row['lean']), float(row['crouch']),
                              float(row['speed_kmh'])/3.6,
                              float(row['Cd']), float(row['CdA'])])

    if len(rows) < 4:
        print(f"Only {len(rows)} valid rows — need at least 4. Run the sweep first.")
        sys.exit(1)

    data = np.array(rows, dtype=np.float32)
    X = data[:, :3]   # lean, crouch, speed_ms
    Y = data[:, 3:]   # Cd, CdA

    # Normalise inputs to [-1, 1]
    X_min, X_max = X.min(0), X.max(0)
    X_range = np.where(X_max > X_min, X_max - X_min, 1.0)
    X_n = 2*(X - X_min)/X_range - 1

    # Normalise outputs to [0, 1]
    Y_min, Y_max = Y.min(0), Y.max(0)
    Y_range = np.where(Y_max > Y_min, Y_max - Y_min, 1.0)
    Y_n = (Y - Y_min) / Y_range

    Xt = torch.tensor(X_n)
    Yt = torch.tensor(Y_n)

    # ---- model -------------------------------------------------------------
    model = nn.Sequential(
        nn.Linear(3, 32), nn.Tanh(),
        nn.Linear(32, 32), nn.Tanh(),
        nn.Linear(32, 2),
    )
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)

    for epoch in range(args.epochs):
        opt.zero_grad()
        loss = nn.functional.mse_loss(model(Xt), Yt)
        loss.backward()
        opt.step()
        sched.step()
        if epoch % 500 == 0:
            print(f"epoch {epoch:5d}  loss {loss.item():.6f}")

    print(f"Final MSE: {loss.item():.6f}")

    # ---- ONNX export -------------------------------------------------------
    dummy = torch.zeros(1, 3)
    torch.onnx.export(
        model, dummy, args.out,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
        opset_version=17,
    )
    print(f"ONNX saved → {args.out}")

    # Save normalisation constants alongside ONNX for browser denorm
    import json
    norm_path = pathlib.Path(args.out).with_suffix('.norm.json')
    json.dump({
        'X_min': X_min.tolist(), 'X_range': X_range.tolist(),
        'Y_min': Y_min.tolist(), 'Y_range': Y_range.tolist(),
        'labels': ['Cd', 'CdA'],
    }, open(norm_path, 'w'), indent=2)
    print(f"Norm constants → {norm_path}")

    # Quick validation
    with torch.no_grad():
        pred_n = model(Xt).numpy()
    pred = pred_n * Y_range + Y_min
    rmse_Cd  = np.sqrt(np.mean((pred[:,0] - Y[:,0])**2))
    rmse_CdA = np.sqrt(np.mean((pred[:,1] - Y[:,1])**2))
    print(f"Train RMSE  Cd={rmse_Cd:.4f}  CdA={rmse_CdA:.4f}")

if __name__ == '__main__':
    main()
