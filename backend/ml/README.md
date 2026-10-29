# LLM Bench — ML Performance Predictor

This package provides a machine-learning performance predictor that estimates local LLM inference speeds (tokens/sec) for specific hardware and model configurations, trained on empirical benchmark runs from `benchmark/run_benchmark.py`.

---

## 1. How It Works

1. **Empirical Benchmarking Data**: The model ingests CSV files from `benchmark/results/*.csv` containing real measurements (`tokens_per_sec`, loaded memory footprints, VRAM utilization).
2. **First-Principles Feature Extraction**:
   - **Footprint Mapping**: Linear mapping from download file size (`file_size_gb`) to loaded memory footprint (`model_size_gb = a * file_size_gb + b`).
   - **GPU VRAM Reserve ($R$)**: Fitted display and OS VRAM overhead via grid search ($R \in [0, 3.0]$ GB).
   - **Physics Latency Features**:
     $$x_{\text{gpu}} = \frac{f \cdot \text{footprint}}{B_{\text{gpu}}}, \quad x_{\text{cpu}} = \frac{(1-f) \cdot \text{footprint}}{B_{\text{cpu}}}$$
     where $f = \text{clip}((V_{\text{vram}} - R) / \text{footprint}, 0, 1)$.
3. **Leave-One-Group-Out (LOGO) Cross-Validation**:
   - Evaluates `MeanBaseline`, `TheoryBaseline`, `PhysicsLinear`, and `RandomForest`.
   - Cross-validation is grouped by machine/hardware-model config to prevent data leakage from repeated runs.
   - All evaluation metrics (MAE, MAPE %, $R^2$) are computed in **tokens/second** space.
4. **Interpretability**:
   - `PhysicsLinear` fits positive coefficients $c_1, c_2$ without intercept:
     $$\text{ms\_per\_token} = c_1 \cdot x_{\text{gpu}} + c_2 \cdot x_{\text{cpu}}$$
   - $c_1$ represents the inverse memory bandwidth efficiency ($\approx 1000 / \eta$), accounting for compute and kernel launch overhead.

---

## 2. Running Training

To train or retrain the model:
```bash
cd backend
python -m ml.train
```

If you are using the project virtual environment on Windows:
```powershell
cd backend
..\venv\Scripts\python.exe -m ml.train
```

---

## 3. Generated Artifacts

Training produces artifacts in `backend/ml/artifacts/`:
- `model.joblib`: Serialized model object, fitted footprint parameters ($a, b$), VRAM reserve $R$, residual standard deviation $\sigma$, and training metadata.
- `metrics.json`: LOGO cross-validation scores across all candidate models, winner metrics, and hardware summary.
- `model_card.md`: Standard model card documenting dataset size, evaluated models, fitted coefficients, limitations, and warnings.
- `pred_vs_actual.png`: Diagnostic scatter plot comparing true vs. predicted generation speeds.
- `per_config_error.png`: Diagnostic bar chart showing percentage error across benchmarked configurations.

---

## 4. Adding New Benchmark Data

1. Run a benchmark using `benchmark/run_benchmark.py`:
   ```bash
   python benchmark/run_benchmark.py --config benchmark/benchmark_config.json
   ```
2. The benchmark will generate or append rows in `benchmark/results/<machine_label>.csv`.
3. Retrain the predictor:
   ```bash
   cd backend
   python -m ml.train
   ```
4. The backend service automatically reloads the updated artifact on next prediction request or startup.
