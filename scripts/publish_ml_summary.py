"""
Publishes the ML model card and metrics summary into $GITHUB_STEP_SUMMARY for CI runs.
Can also be executed locally to preview the summary markdown.
"""
import os
import sys
import json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def generate_summary():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    artifacts_dir = os.path.join(repo_root, "backend", "ml", "artifacts")
    metrics_path = os.path.join(artifacts_dir, "metrics.json")
    model_card_path = os.path.join(artifacts_dir, "model_card.md")

    summary_lines = []
    summary_lines.append("# 🤖 LLM Bench — ML Performance Predictor Summary\n")

    # 1. Metrics JSON Summary Table
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r", encoding="utf-8") as f:
                metrics = json.load(f)

            winner = metrics.get("winner_metrics", {})
            footprint = metrics.get("footprint_params", {})
            models_comp = metrics.get("models_compared", {})

            summary_lines.append("## 📊 Evaluation Overview\n")
            summary_lines.append(f"- **Selected Model**: `{metrics.get('selected_model', 'N/A')}`")
            summary_lines.append(f"- **Dataset Size**: `{metrics.get('n_configs', 0)}` configurations (`{metrics.get('n_configs_gpu', 0)}` GPU / `{metrics.get('n_configs_cpu', 0)}` CPU / `{metrics.get('n_offload', 0)}` partial offload)")
            summary_lines.append(f"- **CPU Bandwidth Term**: `{metrics.get('cpu_term_source', 'N/A')}`")
            summary_lines.append(f"- **Footprint Map Source**: `{metrics.get('footprint_map_source', 'N/A')}` (Safety margin: 15% stopgap)")
            summary_lines.append(f"- **Best LOGO MAPE**: **{winner.get('mape_pct', 0.0):.2f}%** (MAE: `{winner.get('mae_tps', 0.0):.2f}` tok/s, $R^2$: `{winner.get('r2', 0.0):.4f}`)\n")

            if models_comp:
                summary_lines.append("### Cross-Validation Comparison Table\n")
                summary_lines.append("| Model Candidate | LOGO MAE (tok/s) | LOGO MAPE (%) | $R^2$ Score |")
                summary_lines.append("| :--- | :---: | :---: | :---: |")
                for m_name, m_vals in models_comp.items():
                    summary_lines.append(f"| **{m_name}** | {m_vals.get('mae_tps', 0):.2f} | {m_vals.get('mape_pct', 0):.2f}% | {m_vals.get('r2', 0):.4f} |")
                summary_lines.append("")
        except Exception as e:
            summary_lines.append(f"> [!WARNING]\n> Failed to parse metrics.json: {e}\n")
    else:
        summary_lines.append("> [!NOTE]\n> `metrics.json` not found in `backend/ml/artifacts/`.\n")

    # 2. Append full Model Card
    if os.path.exists(model_card_path):
        try:
            with open(model_card_path, "r", encoding="utf-8") as f:
                card_content = f.read()
            summary_lines.append("\n---\n")
            summary_lines.append(card_content)
        except Exception as e:
            summary_lines.append(f"> [!WARNING]\n> Failed to read model_card.md: {e}\n")
    else:
        summary_lines.append("> [!NOTE]\n> `model_card.md` not found in `backend/ml/artifacts/`.\n")

    output_text = "\n".join(summary_lines)

    # Output to $GITHUB_STEP_SUMMARY if present, else print to stdout
    step_summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary_path:
        with open(step_summary_path, "a", encoding="utf-8") as f:
            f.write(output_text + "\n")
        print(f"Successfully appended ML summary to $GITHUB_STEP_SUMMARY ({step_summary_path})")
    else:
        print(output_text)

if __name__ == "__main__":
    generate_summary()
