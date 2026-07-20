import json
import time
from pathlib import Path
from typing import Any, Dict, List

def generate_tesseract_shapes(radius: float) -> list:
    s_outer = radius * 1.5
    s_inner = radius * 0.75
    
    def get_vertices(s):
        hs = s / 2
        return [
            [-hs, -hs, -hs],
            [hs, -hs, -hs],
            [-hs, hs, -hs],
            [hs, hs, -hs],
            [-hs, -hs, hs],
            [hs, -hs, hs],
            [-hs, hs, hs],
            [hs, hs, hs]
        ]
        
    v_outer = get_vertices(s_outer)
    v_inner = get_vertices(s_inner)
    
    edges = [
        (0, 1), (2, 3), (4, 5), (6, 7),
        (0, 2), (1, 3), (4, 6), (5, 7),
        (0, 4), (1, 5), (2, 6), (3, 7)
    ]
    
    shapes = []
    
    # Outer cube edges
    for e in edges:
        shapes.append({
            "type": "line",
            "from": v_outer[e[0]],
            "to": v_outer[e[1]],
            "color": "0x00f0ff",
            "opacity": 0.7
        })
        
    # Inner cube edges
    for e in edges:
        shapes.append({
            "type": "line",
            "from": v_inner[e[0]],
            "to": v_inner[e[1]],
            "color": "0x0088ff",
            "opacity": 0.7
        })
        
    # Diagonal connection lines (outer to inner)
    for i in range(8):
        shapes.append({
            "type": "line",
            "from": v_outer[i],
            "to": v_inner[i],
            "color": "0x3b82f6",
            "opacity": 0.5
        })
        
    return shapes


class LocalStore:
    """
    Manages the local database/log of simulation history, parameters,
    and associated debate snapshots.
    """
    
    def __init__(self, data_dir: str | Path = None):
        if data_dir:
            self.data_dir = Path(data_dir)
        else:
            # Default to the main app simulations data directory
            self.data_dir = Path(__file__).resolve().parents[4] / "mariano" / "data" / "simulations"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.history_file = self.data_dir / "simulation_history.json"
        
    def _read_history(self) -> List[Dict[str, Any]]:
        if not self.history_file.exists():
            return []
        try:
            return json.loads(self.history_file.read_text(encoding="utf-8"))
        except Exception:
            return []
            
    def _write_history(self, history: List[Dict[str, Any]]):
        self.history_file.write_text(json.dumps(history, indent=2), encoding="utf-8")
        
    def log_run(self, simulation_name: str, config: Dict[str, Any], points: List[Dict[str, Any]], debate_context: str = "", overwrite_filename: str = None) -> str:
        """
        Saves the complete simulation run coordinates as a JSON file and records
        the run metadata in the simulation_history.json log.
        Returns the filename of the saved coordinate grid.
        """
        timestamp = int(time.time())
        if overwrite_filename:
            filename = overwrite_filename
        else:
            filename = f"sim_{timestamp}_{simulation_name.lower().replace(' ', '_')}.json"
        target_path = self.data_dir / filename
        
        # Check if tesseract is in the name
        shapes = None
        auto_rotate = False
        if "tesseract" in simulation_name.lower() or "hypercube" in simulation_name.lower() or "4d" in simulation_name.lower() or "cube" in simulation_name.lower():
            radius = float(config["inputs"]["geometry"]["diameter"]) / 2
            shapes = generate_tesseract_shapes(radius)
            auto_rotate = True

        # Build the full coordinate dataset to be loaded by Three.js
        full_payload = {
            "simulation_name": simulation_name,
            "date_run": time.strftime("%Y-%m-%d"),
            "metadata": {
                "max_temperature_c": config["inputs"]["boundary_conditions"]["inlet_temp_c"],
                "min_temperature_c": config["inputs"]["boundary_conditions"]["wall_cooling_temp_c"],
                "thermal_conductivity_w_mk": config["inputs"]["fluid_properties"]["enhanced_thermal_conductivity"],
                "max_shear_stress_pa": config["inputs"]["fluid_properties"]["shear_stress_limit"],
                "pitting_rate_mm_year": config["inputs"]["corrosion_properties"]["pitting_rate_mm_year"],
                "electrolyte_conductivity_s_m": config["inputs"]["fluid_properties"]["conductivity_s_m"],
                "auto_rotate": auto_rotate
            },
            "geometry": {
                "pipe_diameter_mm": config["inputs"]["geometry"]["diameter"],
                "pipe_length_mm": config["inputs"]["geometry"]["length"],
                "wall_thickness_mm": config["inputs"]["geometry"]["thickness"]
            },
            "points": points
        }
        if shapes:
            full_payload["shapes"] = shapes
        
        # Save coordinate file locally
        target_path.write_text(json.dumps(full_payload, indent=2), encoding="utf-8")
        
        # Update history index log
        history = self._read_history()
        existing_run = next((item for item in history if item["filename"] == filename), None)
        if existing_run:
            existing_run["parameters"] = config["inputs"]
            existing_run["date"] = time.strftime("%Y-%m-%d %H:%M:%S")
            existing_run["debate_summary"] = debate_context
        else:
            history.append({
                "run_id": f"run_{timestamp}",
                "simulation_name": simulation_name,
                "timestamp": timestamp,
                "date": time.strftime("%Y-%m-%d %H:%M:%S"),
                "filename": filename,
                "parameters": config["inputs"],
                "debate_summary": debate_context
            })
        self._write_history(history)
        
        return filename

    def get_history(self) -> List[Dict[str, Any]]:
        """
        Returns all historical runs recorded locally.
        """
        return self._read_history()

    def get_run_details(self, filename: str) -> Dict[str, Any] | None:
        """
        Loads and returns the full coordinate details of a specific run.
        """
        target_path = self.data_dir / filename
        if not target_path.exists():
            return None
        try:
            return json.loads(target_path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def validate_run(self, filename: str) -> Dict[str, Any]:
        """
        Validates the structure of a saved simulation JSON.
        Checks for JSON validity, presence of metadata, points, and custom shapes.
        """
        filepath = self.data_dir / filename
        report = {
            "valid_json": False,
            "has_metadata": False,
            "has_points": False,
            "has_shapes": False,
            "shapes_count": 0,
            "errors_or_warnings": []
        }
        
        if not filepath.exists():
            report["errors_or_warnings"].append(f"File {filename} does not exist in the simulations directory.")
            return report
            
        try:
            content = json.loads(filepath.read_text(encoding="utf-8"))
            report["valid_json"] = True
            report["has_metadata"] = "metadata" in content
            report["has_points"] = "points" in content and len(content["points"]) > 0
            
            shapes = content.get("shapes", [])
            if shapes and isinstance(shapes, list):
                report["has_shapes"] = True
                report["shapes_count"] = len(shapes)
            else:
                # If name suggests a custom model, warn about missing shapes
                name = content.get("simulation_name", "").lower()
                is_custom_model = any(word in name for word in ["tesseract", "hypercube", "car", "reactor", "turbine", "drone", "pump", "valve"])
                if is_custom_model:
                    report["errors_or_warnings"].append(
                        f"WARNING: The simulation name '{content.get('simulation_name')}' suggests a custom 3D model, "
                        "but the 'shapes' array is missing or empty. The 3D engine will fall back to a default cylindrical pipe. "
                        "You must write the 'shapes' array into the JSON to render the custom geometry."
                    )
        except Exception as e:
            report["errors_or_warnings"].append(f"Failed to parse JSON file: {str(e)}")
            
        return report
