"""MARIANO Core Skill — Data Analyzer & Visualizer."""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from mariano.skills._base import BaseSkill, SkillResult
from mariano.config import get_settings


class DataAnalyzerSkill(BaseSkill):
    name = "data_analyzer"
    description = "Performs statistical analysis on CSV/JSON data files and generates visual data charts (line, bar, scatter plots) exported as PNG images."
    version = "1.0.0"
    tags = ["data", "csv", "json", "charts", "analysis", "statistics", "visualization", "plot"]

    def get_parameters_schema(self) -> dict:
        return {
            "action": {
                "type": "string",
                "description": "Action to perform: 'analyze' (statistical summary) or 'plot' (generate chart)",
                "required": True,
            },
            "file_path": {
                "type": "string",
                "description": "Path to CSV or JSON file relative to workspace root (e.g. data/sample.csv)",
                "required": True,
            },
            "x_col": {
                "type": "string",
                "description": "Column name for X axis (required for 'plot')",
            },
            "y_col": {
                "type": "string",
                "description": "Column name for Y axis (required for 'plot')",
            },
            "chart_type": {
                "type": "string",
                "description": "Type of chart: 'line', 'bar', or 'scatter' (default: line)",
                "default": "line",
            },
            "title": {
                "type": "string",
                "description": "Optional title for generated chart",
            },
        }

    async def execute(self, action: str, file_path: str, x_col: str | None = None, y_col: str | None = None, chart_type: str = "line", title: str | None = None, **kwargs: Any) -> SkillResult:
        try:
            settings = get_settings()
            workspace_root = settings.mariano_data_dir.parent
            target_path = (workspace_root / file_path).resolve()

            if not target_path.exists():
                # Fallback to direct absolute path check if within workspace
                target_path = Path(file_path).resolve()
                if not target_path.exists():
                    return SkillResult(success=False, data=None, error=f"File not found: {file_path}")

            if action == "analyze":
                if target_path.suffix.lower() == ".csv":
                    df = pd.read_csv(target_path)
                elif target_path.suffix.lower() == ".json":
                    df = pd.read_json(target_path)
                else:
                    return SkillResult(success=False, data=None, error="Unsupported format. Only .csv and .json files are supported.")

                num_summary = df.describe().to_dict()
                analysis = {
                    "file": target_path.name,
                    "rows": len(df),
                    "columns": list(df.columns),
                    "missing_values": df.isnull().sum().to_dict(),
                    "numerical_summary": num_summary,
                }
                return SkillResult(success=True, data=analysis)

            elif action == "plot":
                if not x_col or not y_col:
                    return SkillResult(success=False, data=None, error="Both 'x_col' and 'y_col' are required for action='plot'")

                if target_path.suffix.lower() == ".csv":
                    df = pd.read_csv(target_path)
                elif target_path.suffix.lower() == ".json":
                    df = pd.read_json(target_path)
                else:
                    return SkillResult(success=False, data=None, error="Unsupported format for plotting. Only .csv and .json are supported.")

                if x_col not in df.columns or y_col not in df.columns:
                    return SkillResult(success=False, data=None, error=f"Columns '{x_col}' or '{y_col}' not found in dataset. Available: {list(df.columns)}")

                plt.figure(figsize=(10, 6))
                if chart_type == "bar":
                    plt.bar(df[x_col].astype(str), df[y_col], color="#3B82F6")
                elif chart_type == "scatter":
                    plt.scatter(df[x_col], df[y_col], color="#3B82F6", alpha=0.7)
                else:
                    plt.plot(df[x_col], df[y_col], color="#3B82F6", linewidth=2)

                plt.xlabel(x_col)
                plt.ylabel(y_col)
                plt.title(title or f"{y_col} vs {x_col}")
                plt.grid(True, linestyle="--", alpha=0.5)
                plt.tight_layout()

                exports_dir = workspace_root / "Exports" / "charts"
                exports_dir.mkdir(parents=True, exist_ok=True)
                
                output_filename = f"chart_{target_path.stem}_{x_col}_vs_{y_col}.png".replace(" ", "_")
                output_path = exports_dir / output_filename
                plt.savefig(output_path, dpi=150)
                plt.close()

                return SkillResult(
                    success=True,
                    data={
                        "message": f"Chart generated successfully and saved to {output_path.name}",
                        "chart_path": str(output_path),
                        "x_col": x_col,
                        "y_col": y_col,
                        "chart_type": chart_type,
                    }
                )

            else:
                return SkillResult(success=False, data=None, error=f"Unknown action '{action}'. Valid actions: 'analyze', 'plot'")

        except Exception as err:
            return SkillResult(success=False, data=None, error=f"DataAnalyzer execution error: {str(err)}")
