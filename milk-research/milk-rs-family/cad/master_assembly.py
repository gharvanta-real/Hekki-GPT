# -*- coding: utf-8 -*-
# ==============================================================================
# RIOHS B4 Multimeter Milk Analyzer: Master CAD Assembly
# Designed for execution in FreeCAD Python Console or Macro Player.
#
# This script loads all individual color-coded parts from the casings, 
# electronics, and mechanicals documents, applies a master EXPLODED_VIEW toggle,
# and consolidates the entire 3D design stack into a single master document.
# ==============================================================================

import FreeCAD as App
import Part
import os

# ==============================================================================
# CONFIGURATION OPTION: EXPLODED VIEW TOGGLE
# Set to True to generate the Exploded Assembly View (parts separated along axes).
# Set to False to generate the final closed Assembled View.
# ==============================================================================
EXPLODED_VIEW = True

# Main paths
BASE_DIR = "d:/mariano/milk-research/milk-rs-family/cad/parts/"
OUTPUT_FILE = "d:/mariano/milk-research/milk-rs-family/cad/master_assembly.FCStd"

# Create output document
doc = App.activeDocument()
if doc is None:
    doc = App.newDocument("RIOHS_B4_Master_Assembly")
else:
    doc.clearDocument()

print("Consolidating master assembly (Exploded View = {})...".format(EXPLODED_VIEW))

# Define translation offsets for Exploded View
if EXPLODED_VIEW:
    DY_FRONT = 80.0
    DY_LCD = 115.0
    DY_BUTTONS = 98.0
    DY_PCB = 30.0
    DY_BAT = -25.0
    DY_REAR = -80.0
    DX_LEFT = -45.0
    DX_RIGHT = 45.0
    DZ_PROBE = -50.0
else:
    DY_FRONT = 0.0
    DY_LCD = 0.0
    DY_BUTTONS = 0.0
    DY_PCB = 0.0
    DY_BAT = 0.0
    DY_REAR = 0.0
    DX_LEFT = 0.0
    DX_RIGHT = 0.0
    DZ_PROBE = 0.0

# Source documents to process
sources = [
    "casings_assembly.FCStd",
    "electronics_assembly.FCStd",
    "mechanicals_assembly.FCStd"
]

for src_file in sources:
    full_path = os.path.join(BASE_DIR, src_file)
    if not os.path.exists(full_path):
        print("Warning: Source file {} not found.".format(src_file))
        continue
        
    try:
        # Open source file in background
        temp_doc = App.openDocument(full_path)
        print("Processing source document: {} (found {} objects)".format(src_file, len(temp_doc.Objects)))
        
        for src_obj in temp_doc.Objects:
            # Only process features that carry a 3D Shape
            if not hasattr(src_obj, "Shape") or src_obj.Shape is None:
                continue
                
            part_name = src_obj.Name
            
            # Skip group container folders
            if src_obj.isDerivedFrom("App::DocumentObjectGroup"):
                continue
                
            # Determine translation offset by matching name patterns
            offset = App.Vector(0.0, 0.0, 0.0)
            name_lower = part_name.lower()
            
            if "front_housing" in name_lower or "front_screw_bosses" in name_lower:
                offset = App.Vector(0.0, DY_FRONT, 0.0)
            elif "rear_housing" in name_lower:
                offset = App.Vector(0.0, DY_REAR, 0.0)
            elif any(k in name_lower for k in ["pcb", "esp32", "ad5933", "opa350", "resistor", "capacitor", "smd"]):
                offset = App.Vector(0.0, DY_PCB, 0.0)
            elif any(k in name_lower for k in ["lipo", "pcm", "wire"]):
                offset = App.Vector(0.0, DY_BAT, 0.0)
            elif any(k in name_lower for k in ["tft", "bezel", "lcd", "glass"]):
                offset = App.Vector(0.0, DY_LCD, 0.0)
            elif any(k in name_lower for k in ["dpad", "keycap", "silicone"]):
                offset = App.Vector(0.0, DY_BUTTONS, 0.0)
            elif "grip" in name_lower or "bumper" in name_lower:
                if "left" in name_lower:
                    offset = App.Vector(DX_LEFT, 0.0, 0.0)
                else:
                    offset = App.Vector(DX_RIGHT, 0.0, 0.0)
            elif any(k in name_lower for k in ["probe", "electrode", "pin"]):
                offset = App.Vector(0.0, 0.0, DZ_PROBE)
            elif "screw" in name_lower:
                offset = App.Vector(0.0, DY_REAR, 0.0)
                
            # Copy shape geometry
            shape_copy = src_obj.Shape.copy()
            shape_copy.translate(offset)
            
            # Create object in master document
            master_obj = doc.addObject("Part::Feature", part_name)
            master_obj.Shape = shape_copy
            
            # Safely copy visual properties (handles headless freecadcmd.exe where ViewObject is None)
            if hasattr(src_obj, "ViewObject") and src_obj.ViewObject is not None:
                if hasattr(master_obj, "ViewObject") and master_obj.ViewObject is not None:
                    try:
                        master_obj.ViewObject.ShapeColor = src_obj.ViewObject.ShapeColor
                        master_obj.ViewObject.Transparency = src_obj.ViewObject.Transparency
                    except Exception:
                        pass
                        
            print("  Consolidated part: {} -> Offset Y: {}, Z: {}".format(part_name, offset.y, offset.z))
            
        App.closeDocument(temp_doc.Name)
    except Exception as e:
        print("Error processing source file {}: {}".format(src_file, str(e)))

# Recompute and save document
doc.recompute()
doc.saveAs(OUTPUT_FILE)
print("Master CAD Assembly document successfully saved to: {}".format(OUTPUT_FILE))
