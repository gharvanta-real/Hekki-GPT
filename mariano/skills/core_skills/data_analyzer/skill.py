"""MARIANO Core Skill v2.0.0 — Peak Data Analytics & Visualization Engine."""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from mariano.skills._base import BaseSkill, SkillResult
from mariano.config import get_settings


class DataAnalyzerSkill(BaseSkill):
    name = "data_analyzer"
    description = "Peak Data Science Engine: Deep statistical analysis, correlation heatmaps, trend forecasting, multi-column comparison, and publication-quality visual charts across CSV, Excel, JSON, TSV, and Parquet datasets."
    version = "2.0.0"
    tags = ["data", "csv", "excel", "xlsx", "json", "charts", "analysis", "statistics", "visualization", "plot", "heatmap", "trend", "forecast", "correlation"]

    COLOR_PALETTE = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#6366F1"]

    def get_parameters_schema(self) -> dict:
        return {
            "action": {
                "type": "string",
                "description": "Action: 'analyze' (deep statistical summary), 'plot' (visual chart), 'heatmap' (correlation grid), or 'trend' (linear forecast & trendline)",
                "required": True,
            },
            "file_path": {
                "type": "string",
                "description": "Path to data file (CSV, Excel .xlsx, JSON, TSV, Parquet) relative to workspace or filename",
                "required": True,
            },
            "x_col": {
                "type": "string",
                "description": "Column name for X axis (required for 'plot' and 'trend')",
            },
            "y_col": {
                "type": "string",
                "description": "Column name(s) for Y axis (single column or comma-separated e.g. 'Sales,Profit')",
            },
            "chart_type": {
                "type": "string",
                "description": "Chart style: 'line', 'bar', 'barh', 'scatter', 'hist', 'box', 'pie', 'area' (default: line)",
                "default": "line",
            },
            "title": {
                "type": "string",
                "description": "Custom title for generated chart",
            },
            "top_n": {
                "type": "integer",
                "description": "Limit top N rows for bar/pie charts (default: 20)",
                "default": 20,
            },
        }

    def _load_dataset(self, file_path: Path) -> pd.DataFrame:
        suf = file_path.suffix.lower()
        if suf == ".csv":
            return pd.read_csv(file_path)
        elif suf in [".xlsx", ".xls"]:
            return pd.read_excel(file_path)
        elif suf == ".json":
            return pd.read_json(file_path)
        elif suf == ".tsv":
            return pd.read_csv(file_path, sep="\t")
        elif suf == ".parquet":
            return pd.read_parquet(file_path)
        else:
            # Fallback csv
            return pd.read_csv(file_path)

    async def execute(self, action: str, file_path: str, x_col: str | None = None, y_col: str | None = None, chart_type: str = "line", title: str | None = None, top_n: int = 20, **kwargs: Any) -> SkillResult:
        try:
            from mariano.core.workspace import PathGuard

            settings = get_settings()
            workspace_root = settings.mariano_data_dir.parent

            # Robust multi-location file resolution across active project sandbox and workspace root
            target_path = None
            try:
                sp = PathGuard.secure_path(file_path)
                if sp.exists():
                    target_path = sp
            except Exception:
                pass

            if not target_path or not target_path.exists():
                candidates = [
                    (workspace_root / file_path).resolve(),
                    (settings.mariano_data_dir / file_path).resolve(),
                    (settings.mariano_data_dir / "workspace" / file_path).resolve(),
                    (settings.mariano_data_dir / "workspace" / "default" / file_path).resolve(),
                    Path(file_path).resolve(),
                ]
                for cand in candidates:
                    if cand.exists():
                        target_path = cand
                        break

            if not target_path or not target_path.exists():
                fname = Path(file_path).name
                if fname:
                    for match in workspace_root.rglob(fname):
                        if match.is_file():
                            target_path = match.resolve()
                            break

            if not target_path or not target_path.exists():
                return SkillResult(success=False, data=None, error=f"File not found: '{file_path}'. Searched across workspace roots.")

            df = self._load_dataset(target_path)
            if df.empty:
                return SkillResult(success=False, data=None, error=f"Dataset '{target_path.name}' is empty.")

            exports_dir = workspace_root / "Exports" / "charts"
            exports_dir.mkdir(parents=True, exist_ok=True)

            # ── 1. DEEP STATISTICAL ANALYSIS ──────────────────────────────────────
            if action == "analyze":
                num_df = df.select_dtypes(include=[np.number])
                cat_df = df.select_dtypes(exclude=[np.number])

                num_summary = {}
                if not num_df.empty:
                    desc = num_df.describe().to_dict()
                    skewness = num_df.skew().to_dict()
                    for col_name in num_df.columns:
                        col_dict = {k: float(v[col_name]) for k, v in desc.items() if col_name in v}
                        col_dict["skewness"] = float(skewness.get(col_name, 0.0))
                        
                        # IQR Outlier Detection
                        q1 = col_dict.get("25%", 0.0)
                        q3 = col_dict.get("75%", 0.0)
                        iqr = q3 - q1
                        outliers = int(((num_df[col_name] < (q1 - 1.5 * iqr)) | (num_df[col_name] > (q3 + 1.5 * iqr))).sum())
                        col_dict["outliers_count"] = outliers
                        num_summary[col_name] = col_dict

                cat_summary = {}
                if not cat_df.empty:
                    for col_name in cat_df.columns[:10]: # limit to top 10 cat cols
                        top_vals = cat_df[col_name].value_counts().head(5).to_dict()
                        cat_summary[col_name] = {
                            "unique_count": int(cat_df[col_name].nunique()),
                            "top_5": {str(k): int(v) for k, v in top_vals.items()}
                        }

                correlations = {}
                if num_df.shape[1] >= 2:
                    corr_matrix = num_df.corr().round(3).to_dict()
                    correlations = {str(k): {str(k2): float(v2) for k2, v2 in v.items()} for k, v in corr_matrix.items()}

                analysis = {
                    "file": target_path.name,
                    "rows": len(df),
                    "columns_count": len(df.columns),
                    "columns": list(df.columns),
                    "missing_values": {str(k): int(v) for k, v in df.isnull().sum().to_dict().items() if v > 0},
                    "numerical_analysis": num_summary,
                    "categorical_analysis": cat_summary,
                    "correlation_matrix": correlations,
                }
                return SkillResult(success=True, data=analysis)

            # ── 2. VISUAL CHARTS (PLOT) ───────────────────────────────────────────
            elif action == "plot":
                if not y_col:
                    return SkillResult(success=False, data=None, error="Parameter 'y_col' is required for action='plot'")

                y_cols = [c.strip() for c in y_col.split(",") if c.strip() in df.columns]
                if not y_cols:
                    return SkillResult(success=False, data=None, error=f"Specified y_col '{y_col}' not found in dataset columns: {list(df.columns)}")

                plot_df = df.head(top_n) if chart_type in ["bar", "barh", "pie"] else df

                plt.figure(figsize=(10, 5.5), dpi=150)
                plt.style.use('ggplot')

                if chart_type == "bar":
                    x_vals = plot_df[x_col].astype(str) if x_col and x_col in plot_df.columns else plot_df.index.astype(str)
                    x = np.arange(len(x_vals))
                    width = 0.8 / len(y_cols)
                    for i, col_name in enumerate(y_cols):
                        color = self.COLOR_PALETTE[i % len(self.COLOR_PALETTE)]
                        plt.bar(x + i * width, plot_df[col_name], width, label=col_name, color=color)
                    if x_col:
                        plt.xticks(x + width * (len(y_cols) - 1) / 2, x_vals, rotation=45, ha='right')

                elif chart_type == "barh":
                    x_vals = plot_df[x_col].astype(str) if x_col and x_col in plot_df.columns else plot_df.index.astype(str)
                    y = np.arange(len(x_vals))
                    height = 0.8 / len(y_cols)
                    for i, col_name in enumerate(y_cols):
                        color = self.COLOR_PALETTE[i % len(self.COLOR_PALETTE)]
                        plt.barh(y + i * height, plot_df[col_name], height, label=col_name, color=color)
                    if x_col:
                        plt.yticks(y + height * (len(y_cols) - 1) / 2, x_vals)

                elif chart_type == "scatter":
                    if not x_col or x_col not in df.columns:
                        return SkillResult(success=False, data=None, error="Parameter 'x_col' required for scatter plot.")
                    for i, col_name in enumerate(y_cols):
                        color = self.COLOR_PALETTE[i % len(self.COLOR_PALETTE)]
                        plt.scatter(df[x_col], df[col_name], label=col_name, color=color, alpha=0.75, edgecolors='none', s=45)

                elif chart_type == "hist":
                    for i, col_name in enumerate(y_cols):
                        color = self.COLOR_PALETTE[i % len(self.COLOR_PALETTE)]
                        plt.hist(df[col_name].dropna(), bins=20, alpha=0.6, label=col_name, color=color)

                elif chart_type == "box":
                    data_to_plot = [df[c].dropna() for c in y_cols]
                    plt.boxplot(data_to_plot, labels=y_cols, patch_artist=True)

                elif chart_type == "pie":
                    first_y = y_cols[0]
                    labels = plot_df[x_col].astype(str) if x_col and x_col in plot_df.columns else plot_df.index.astype(str)
                    plt.pie(plot_df[first_y], labels=labels, autopct='%1.1f%%', colors=self.COLOR_PALETTE[:len(plot_df)], startangle=140)

                elif chart_type == "area":
                    x_vals = df[x_col] if x_col and x_col in df.columns else df.index
                    for i, col_name in enumerate(y_cols):
                        color = self.COLOR_PALETTE[i % len(self.COLOR_PALETTE)]
                        plt.fill_between(x_vals, df[col_name], alpha=0.4, label=col_name, color=color)
                        plt.plot(x_vals, df[col_name], color=color, linewidth=1.5)

                else: # Default Line Plot
                    x_vals = df[x_col] if x_col and x_col in df.columns else df.index
                    for i, col_name in enumerate(y_cols):
                        color = self.COLOR_PALETTE[i % len(self.COLOR_PALETTE)]
                        plt.plot(x_vals, df[col_name], label=col_name, color=color, linewidth=2, marker='o' if len(df) <= 20 else None, markersize=4)

                plt.xlabel(x_col if x_col else "Index")
                plt.ylabel(", ".join(y_cols))
                plt.title(title or f"{', '.join(y_cols)} Visualization ({target_path.name})")
                if len(y_cols) > 1 or chart_type in ["line", "scatter", "hist", "area"]:
                    plt.legend(loc='best')
                plt.grid(True, linestyle="--", alpha=0.4)
                plt.tight_layout()

                output_filename = f"chart_{target_path.stem}_{chart_type}_{'_'.join(y_cols)}.png".replace(" ", "_")
                output_path = exports_dir / output_filename
                plt.savefig(output_path, dpi=150)
                plt.close()

                return SkillResult(
                    success=True,
                    data={
                        "message": f"High-fidelity {chart_type} chart generated and saved to {output_path.name}",
                        "chart_path": str(output_path),
                        "x_col": x_col,
                        "y_cols": y_cols,
                        "chart_type": chart_type,
                    }
                )

            # ── 3. CORRELATION HEATMAP ───────────────────────────────────────────
            elif action == "heatmap":
                num_df = df.select_dtypes(include=[np.number])
                if num_df.shape[1] < 2:
                    return SkillResult(success=False, data=None, error="Dataset requires at least 2 numerical columns for a correlation heatmap.")

                corr = num_df.corr()

                fig, ax = plt.subplots(figsize=(8, 6.5), dpi=150)
                cax = ax.matshow(corr, cmap='coolwarm', vmin=-1, vmax=1)
                fig.colorbar(cax)

                cols = list(num_df.columns)
                ax.set_xticks(range(len(cols)))
                ax.set_yticks(range(len(cols)))
                ax.set_xticklabels(cols, rotation=45, ha="left")
                ax.set_yticklabels(cols)

                # Annotate values inside matrix
                for i in range(len(cols)):
                    for j in range(len(cols)):
                        val = corr.iloc[i, j]
                        ax.text(j, i, f"{val:.2f}", ha='center', va='center', color='black' if abs(val) < 0.7 else 'white', fontsize=9)

                plt.title(title or f"Correlation Heatmap ({target_path.name})", pad=20)
                plt.tight_layout()

                output_filename = f"heatmap_{target_path.stem}.png".replace(" ", "_")
                output_path = exports_dir / output_filename
                plt.savefig(output_path, dpi=150)
                plt.close()

                return SkillResult(
                    success=True,
                    data={
                        "message": f"Correlation Heatmap saved to {output_path.name}",
                        "chart_path": str(output_path),
                        "columns": cols,
                    }
                )

            # ── 4. TREND FORECASTING ─────────────────────────────────────────────
            elif action == "trend":
                if not x_col or not y_col:
                    return SkillResult(success=False, data=None, error="Both 'x_col' and 'y_col' are required for action='trend'")

                if x_col not in df.columns or y_col not in df.columns:
                    return SkillResult(success=False, data=None, error=f"Columns '{x_col}' or '{y_col}' not found in dataset.")

                # Fit polynomial linear regression
                x_data = np.arange(len(df))
                y_data = df[y_col].values
                
                valid_mask = ~np.isnan(y_data)
                x_clean = x_data[valid_mask]
                y_clean = y_data[valid_mask]

                if len(x_clean) < 2:
                    return SkillResult(success=False, data=None, error="Not enough valid numerical data points for trend fitting.")

                slope, intercept = np.polyfit(x_clean, y_clean, 1)
                y_pred = slope * x_data + intercept

                # R-squared calculation
                ss_res = np.sum((y_clean - (slope * x_clean + intercept)) ** 2)
                ss_tot = np.sum((y_clean - np.mean(y_clean)) ** 2)
                r_squared = float(1 - (ss_res / (ss_tot + 1e-9)))

                plt.figure(figsize=(10, 5.5), dpi=150)
                plt.style.use('ggplot')
                plt.plot(df[x_col], df[y_col], 'o-', label='Actual Data', color='#3B82F6', linewidth=2)
                plt.plot(df[x_col], y_pred, '--', label=f'Linear Trend (Slope: {slope:.3f}, R²: {r_squared:.2f})', color='#EF4444', linewidth=2)

                plt.xlabel(x_col)
                plt.ylabel(y_col)
                plt.title(title or f"Trend Analysis: {y_col} vs {x_col} ({target_path.name})")
                plt.legend(loc='best')
                plt.grid(True, linestyle="--", alpha=0.4)
                plt.tight_layout()

                output_filename = f"trend_{target_path.stem}_{y_col}_vs_{x_col}.png".replace(" ", "_")
                output_path = exports_dir / output_filename
                plt.savefig(output_path, dpi=150)
                plt.close()

                return SkillResult(
                    success=True,
                    data={
                        "file": target_path.name,
                        "slope": float(slope),
                        "intercept": float(intercept),
                        "r_squared": float(r_squared),
                        "direction": "Upward" if slope > 0 else "Downward" if slope < 0 else "Flat",
                        "chart_path": str(output_path),
                    }
                )

            else:
                return SkillResult(success=False, data=None, error=f"Unknown action '{action}'. Valid actions: 'analyze', 'plot', 'heatmap', 'trend'")

        except Exception as err:
            return SkillResult(success=False, data=None, error=f"DataAnalyzer v2.0.0 execution error: {str(err)}")
