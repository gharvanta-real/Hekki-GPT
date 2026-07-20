import json
from pathlib import Path
from typing import Any, Dict

class ParameterMapper:
    """
    Maps consensus parameters from debate runs or user overrides
    into standard JSON solver configurations for NVIDIA Modulus on Kaggle.
    """
    
    @staticmethod
    def validate_params(params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates MSR and fluid parameters, applying default bounds.
        """
        validated = {}
        
        # Geometry defaults/validation
        validated["pipe_diameter_mm"] = float(params.get("pipe_diameter_mm", 50.0))
        validated["pipe_length_mm"] = float(params.get("pipe_length_mm", 300.0))
        validated["wall_thickness_mm"] = float(params.get("wall_thickness_mm", 10.0))
        
        # Temperature boundaries (MSR FLiBe limits)
        max_temp = float(params.get("max_temperature_c", 700.0))
        min_temp = float(params.get("min_temperature_c", 200.0))
        if max_temp <= min_temp:
            raise ValueError(f"Max temperature ({max_temp}C) must exceed min temperature ({min_temp}C)")
        validated["max_temperature_c"] = max_temp
        validated["min_temperature_c"] = min_temp
        
        # Physical fluid values (FLiBe + Carbon Nanotubes enhancement)
        validated["thermal_conductivity_w_mk"] = float(params.get("thermal_conductivity_w_mk", 25.0))
        validated["max_shear_stress_pa"] = float(params.get("max_shear_stress_pa", 4.5))
        validated["pitting_rate_mm_year"] = float(params.get("pitting_rate_mm_year", 1.25))
        validated["electrolyte_conductivity_s_m"] = float(params.get("electrolyte_conductivity_s_m", 2.1))
        
        return validated

    @classmethod
    def generate_config(cls, params: Dict[str, Any], output_path: str | Path = None) -> Dict[str, Any]:
        """
        Builds the structured configuration JSON. If output_path is provided, writes to file.
        """
        validated = cls.validate_params(params)
        
        # Structure representing parameters to feed the PINN (Physics Informed Neural Network)
        solver_config = {
            "simulation_name": params.get("simulation_name", "MSR Primary Heat Exchanger Run"),
            "solver_type": "PINN_3D_Cylinder",
            "physics_model": "NVIDIA_Modulus_Thermal_Corrosion",
            "inputs": {
                "geometry": {
                    "diameter": validated["pipe_diameter_mm"],
                    "length": validated["pipe_length_mm"],
                    "thickness": validated["wall_thickness_mm"]
                },
                "boundary_conditions": {
                    "inlet_temp_c": validated["max_temperature_c"],
                    "wall_cooling_temp_c": validated["min_temperature_c"]
                },
                "fluid_properties": {
                    "enhanced_thermal_conductivity": validated["thermal_conductivity_w_mk"],
                    "shear_stress_limit": validated["max_shear_stress_pa"],
                    "conductivity_s_m": validated["electrolyte_conductivity_s_m"]
                },
                "corrosion_properties": {
                    "pitting_rate_mm_year": validated["pitting_rate_mm_year"]
                }
            }
        }
        
        if output_path:
            p = Path(output_path)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(solver_config, indent=2), encoding="utf-8")
            
        return solver_config
