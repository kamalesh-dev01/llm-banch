# LLM Bench Performance Predictor — Model Card

> [!WARNING]
> **DEV DATA - retrain on clean benchmark**
> The training dataset contains only **4** configurations (< 8 recommended minimum).
> Model metrics and predictions are illustrative only. Collect benchmark data on diverse hardware
> before relying on these predictions for production hardware recommendations.

## 1. Overview
This ML model predicts local LLM inference performance (tokens per second) on consumer GPUs.
It replaces heuristic lookup tables with a first-principles physics-guided regression model trained
on actual Ollama inference benchmarks collected with `benchmark/run_benchmark.py`.

## 2. Dataset Summary
- **Total Configurations**: 4
- **Evaluated Models**: llama3.2:1b, llama3.2:3b, qwen2.5:0.5b, qwen2.5:1.5b
- **Benchmarked Hardware**: NVIDIA GeForce RTX 2050
- **Target Metric**: Generation speed (tokens/second) converted from millisecond-per-token inference latency.
- **Evaluation Grouping**: Leave-One-Group-Out (LOGO) cross-validation grouped by unique hardware-model configuration.

## 3. Leave-One-Group-Out (LOGO) Cross-Validation Results

| Model | LOGO MAE (tokens/s) | LOGO MAPE (%) | $R^2$ |
| :--- | :---: | :---: | :---: |
| MeanBaseline | 34.5 | 52.96% | -0.8143 |
| TheoryBaseline | 46.24 | 50.64% | -4.2591 |
| PhysicsLinear | 33.62 | 42.01% | -1.5036 |
| RandomForest | 32.3 | 48.33% | -0.3345 |

**Selected Model**: `PhysicsLinear` (Lowest LOGO MAPE: 42.01%)

## 4. Fitted Parameters & Physical Interpretation
- **Loaded Footprint Mapping**: `model_size_gb = 1.100 * file_size_gb + 0.100` (source: `default+margin`; safety margin: 15% stopgap applied)
- **Fitted VRAM OS/Display Reserve ($R$)**: `1.85 GB`
- **Physics Linear Coefficients**:
  - `coeff_gpu`: `1000.0` (supported by 4 configs. Implies ~100.0% effective memory bandwidth utilization due to compute kernel overhead; efficiency cannot exceed 100%).
  - `coeff_cpu`: `1666.7` (source: `prior`; supported by 1 configs with offload < 0.95).
- **CPU Term Source**: `prior`. Because the dataset currently has 1 configuration(s) with offload < 0.95 (less than the minimum threshold of 3 configs required for empirical fitting), the CPU term is anchored to a stated prior of 60% of theoretical dual-channel RAM bandwidth (`coeff_cpu = 1000 / 0.6 = 1666.7`) to prevent ungrounded extrapolation.

## 5. Artifacts
- `model.joblib`: Trained model pipeline and parameters.
- `metrics.json`: LOGO cross-validation scores and training metadata.
- `pred_vs_actual.png`: Out-of-fold predicted speed vs actual speed.
- `per_config_error.png`: Percentage error across benchmarked configurations.

## 6. How to Retrain
To retrain with new benchmark runs:
```bash
cd backend
python -m ml.train
```
