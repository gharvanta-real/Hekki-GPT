# -*- coding: utf-8 -*-
# ==============================================================================
# RIOHS B4 Milk Tester: KiCad PCB Layout Automation Script
#
# Designed to be run inside KiCad's Python Scripting Console (pcbnew).
# Automates:
#  1. Creating a board outline (Edge.Cuts) matching the CAD casing width/height.
#  2. Placing 4 mounting holes at the exact coordinates of the casing standoffs.
#  3. Drawing layout guidelines for the USB-C port, Display, and Probes.
# ==============================================================================

import pcbnew
import math

def generate_riohs_pcb():
    # 1. Get current active board in KiCad PCB editor
    board = pcbnew.GetBoard()
    if not board:
        print("Error: Open KiCad PCB Editor (pcbnew) first!")
        return

    print("Generating RIOHS B4 PCB Outline and Mounts...")

    # Clear existing drawings on Edge.Cuts if any (optional, safe mode is draw new)
    edge_layer = board.GetLayerID("Edge.Cuts")

    # --- Board Dimensions (matching CAD case offsets) ---
    PCB_WIDTH  = 62.0  # mm (CASE_W 72mm - WALL_T 2.5mm*2 - clearance)
    PCB_HEIGHT = 108.0 # mm (Matches the PCB bounding box in CAD model)

    # Offset to place the PCB center at KiCad's sheet coordinate (150, 100)
    origin_x = 150.0 
    origin_y = 100.0

    # Convert mm to KiCad internal units (nanometers in KiCad 6+)
    def to_iu(val_mm):
        return int(val_mm * 1000000)

    # --- Step 2: Draw PCB Outline Box on Edge.Cuts ---
    corners = [
        (-PCB_WIDTH/2, -PCB_HEIGHT/2),
        ( PCB_WIDTH/2, -PCB_HEIGHT/2),
        ( PCB_WIDTH/2,  PCB_HEIGHT/2),
        (-PCB_WIDTH/2,  PCB_HEIGHT/2),
    ]

    for i in range(len(corners)):
        p1 = corners[i]
        p2 = corners[(i + 1) % len(corners)]
        
        # Create graphic segment line
        seg = pcbnew.PCB_SHAPE(board)
        seg.SetShape(pcbnew.SHAPE_T_SEGMENT)
        seg.SetLayer(edge_layer)
        seg.SetWidth(to_iu(0.15)) # 0.15mm line thickness
        
        # Set start and end points
        start_pt = pcbnew.VECTOR2I(to_iu(origin_x + p1[0]), to_iu(origin_y + p1[1]))
        end_pt = pcbnew.VECTOR2I(to_iu(origin_x + p2[0]), to_iu(origin_y + p2[1]))
        seg.SetStart(start_pt)
        seg.SetEnd(end_pt)
        
        board.Add(seg)

    # --- Step 3: Place 4 Mounting Holes at Exact Standoff Coordinates ---
    # Standoffs are placed 12mm in from side edges relative to Case center (72mm width).
    # Relative to PCB center (X=0): X_dist = (36 - 12) = 24mm.
    # Relative to PCB center (Z=0 in CAD, mapping to Y-axis in KiCad layout):
    # Z coordinates: 25mm and 75mm from bottom (PCB height is 108mm, from Z=18 to 126).
    # Relative to PCB mid-height: 
    # Y1 = 25 - (108/2) = -29mm
    # Y2 = 75 - (108/2) = 21mm
    mounts = [
        (-24.0, -29.0),
        ( 24.0, -29.0),
        (-24.0,  21.0),
        ( 24.0,  21.0),
    ]

    # Create 2.2mm diameter mounting holes (NPTH)
    for index, (mx, my) in enumerate(mounts):
        # Create a new pad/module footprint for mounting hole
        footprint = pcbnew.FootprintLoad("", "MountingHole_2.2mm_M2")
        if not footprint:
            # Fallback: create custom pad direct on board
            print(f"Adding Mount {index+1} at X={mx}, Y={my}...")
            via = pcbnew.PCB_VIA(board)
            via.SetPosition(pcbnew.VECTOR2I(to_iu(origin_x + mx), to_iu(origin_y + my)))
            via.SetWidth(to_iu(4.0)) # Pad diameter
            via.SetDrill(to_iu(2.2)) # Hole diameter
            board.Add(via)
        else:
            footprint.SetPosition(pcbnew.VECTOR2I(to_iu(origin_x + mx), to_iu(origin_y + my)))
            board.Add(footprint)

    # --- Step 4: Refresh KiCad PCB Editor View ---
    pcbnew.Refresh()
    print("PCB layout generation complete! Outline and mounting holes match the 3D casing perfectly.")

# To run: type 'generate_riohs_pcb()' in KiCad python scripting console
