# -*- coding: utf-8 -*-
# ==============================================================================
# RIOHS B4 Multimeter Milk Analyzer: Detailed Electronics 3D CAD Assembly
# Designed for execution in FreeCAD Python Console or Macro Player.
#
# Technical Specifications & TRL Classification:
# - Technology Readiness Level (TRL) Demarcation: TRL 1-2 (Conceptual/Theoretical).
# - This geometry and layout are calculated via CAD/FEM simulation models, NOT
#   measured in the lab. 
# - Required Testing Protocols for Physical Verification:
#   * Mechanical and dimensional properties: Universal Testing Machine under ASTM D638.
#   * Thermal stability: DSC thermogram under ASTM D3418 and TGA under ASTM E1131.
#   * Electrical and Battery performance (1200mAh capacity): UN 38.3 standard.
# ==============================================================================

import os
import math
import FreeCAD as App
import Part

print("Initializing FreeCAD document for RIOHS B4 Electronics Assembly...")

# Ensure output directory exists
output_dir = "d:/mariano/milk-research/milk-rs-family/cad/parts"
os.makedirs(output_dir, exist_ok=True)
fcstd_path = os.path.join(output_dir, "electronics_assembly.FCStd")

# Create or reuse document
doc = App.activeDocument()
if doc is None or doc.Name != "RIOHS_B4_Electronics_Assembly":
    doc = App.newDocument("RIOHS_B4_Electronics_Assembly")

# Configuration flag for Exploded View
# True: Separates components along Y axis for easier visual inspection of details.
# False: Placed in final assembled locations.
EXPLODED_VIEW = True

# --- Positioning Parameters (matching mechanical case coordinate system) ---
CASE_D = 24.0
WALL_T = 2.5
PCB_STANDOFF_H = 4.0

if EXPLODED_VIEW:
    PCB_Y = 0.0
    BAT_Y = -40.0
    LCD_Y = 40.0
else:
    PCB_Y = -CASE_D/2.0 + WALL_T + PCB_STANDOFF_H  # -5.5
    BAT_Y = -11.5
    LCD_Y = CASE_D/2.0 - 2.0 + 0.2                 # 10.2

print(f"Generating 3D solids (Exploded View = {EXPLODED_VIEW})...")

# Helper function to create and color-code objects in the tree view
def create_part(shape, name, color=None, transparency=0, group=None):
    # Remove existing object if it exists to allow re-runs
    old_obj = doc.getObject(name)
    if old_obj is not None:
        doc.removeObject(name)
        
    obj = doc.addObject("Part::Feature", name)
    obj.Shape = shape
    
    # In headless/console mode, ViewObject is None. Color properties are only applied if ViewObject exists.
    if obj.ViewObject is not None:
        if color:
            obj.ViewObject.ShapeColor = color
        if transparency > 0:
            obj.ViewObject.Transparency = transparency
            
    if group:
        group.addObject(obj)
    return obj

# ==============================================================================
# 1. ESP32_S3_PCB_Core Group
# ==============================================================================
# Remove group if it exists
old_group = doc.getObject("ESP32_S3_PCB_Core")
if old_group is not None:
    doc.removeObject("ESP32_S3_PCB_Core")
pcb_group = doc.addObject("App::DocumentObjectGroup", "ESP32_S3_PCB_Core")

# PCB FR4 Green Board
pcb_w = 59.0
pcb_h = 105.0
pcb_t = 1.6
pcb_board = Part.makeBox(pcb_w, pcb_t, pcb_h)
pcb_board.translate(App.Vector(-pcb_w/2.0, PCB_Y, 20.0))

# 4 Mounting Holes (diameter 2.5mm, radius 1.25mm)
pcb_screw_coords = [
    (-22.0, 75.0),
    (22.0, 75.0),
    (-22.0, 25.0),
    (22.0, 25.0)
]
for sx, sz in pcb_screw_coords:
    # Cylinder length slightly larger than board thickness
    hole = Part.makeCylinder(1.25, pcb_t + 1.0)
    hole.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
    hole.translate(App.Vector(sx, PCB_Y + pcb_t + 0.5, sz))
    pcb_board = pcb_board.cut(hole)

create_part(pcb_board, "PCB_Green_Board", (0.05, 0.45, 0.15), group=pcb_group)

# ESP32-S3 Shield (Silver metal box)
shield_w = 18.0
shield_d = 1.2
shield_h = 16.0
shield = Part.makeBox(shield_w, shield_d, shield_h)
shield.translate(App.Vector(-shield_w/2.0, PCB_Y + pcb_t, 95.0))
create_part(shield, "ESP32_S3_Shield", (0.8, 0.8, 0.82), group=pcb_group)

# ESP32-S3 Antenna Block (Black plastic)
antenna_w = 18.0
antenna_d = 1.4
antenna_h = 4.0
antenna = Part.makeBox(antenna_w, antenna_d, antenna_h)
antenna.translate(App.Vector(-antenna_w/2.0, PCB_Y + pcb_t, 111.0))
create_part(antenna, "ESP32_S3_Antenna", (0.1, 0.1, 0.1), group=pcb_group)

# USB-C Port Metal Housing
usb_w = 9.0
usb_d = 3.2
usb_h = 7.5
usb_outer = Part.makeBox(usb_w, usb_d, usb_h)
usb_outer.translate(App.Vector(-usb_w/2.0, PCB_Y + pcb_t, 14.5))

usb_inner = Part.makeBox(usb_w - 0.8, usb_d - 0.8, usb_h + 1.0)
usb_inner.translate(App.Vector(-usb_w/2.0 + 0.4, PCB_Y + pcb_t + 0.4, 14.0))

usb_port = usb_outer.cut(usb_inner)
create_part(usb_port, "USB_C_Port", (0.78, 0.78, 0.8), group=pcb_group)

# Inside black plastic tongue for USB-C
usb_tongue = Part.makeBox(usb_w - 2.5, 0.6, usb_h - 2.0)
usb_tongue.translate(App.Vector(-usb_w/2.0 + 1.25, PCB_Y + pcb_t + 1.3, 16.0))
create_part(usb_tongue, "USB_C_Tongue", (0.1, 0.1, 0.1), group=pcb_group)

# AD5933 Chip (Impedance Converter)
# Body (Black plastic)
ad_w = 5.3
ad_d = 1.8
ad_h = 6.2
ad_body = Part.makeBox(ad_w, ad_d, ad_h)
ad_body.translate(App.Vector(-15.0 - ad_w/2.0, PCB_Y + pcb_t, 50.0 - ad_h/2.0))
create_part(ad_body, "AD5933_Body", (0.15, 0.15, 0.15), group=pcb_group)

# AD5933 Silver pins (8 on each side)
ad_pins_list = []
for i in range(8):
    pin_z = 50.0 - ad_h/2.0 + 0.4 + i * 0.75
    # Left pin
    lp = Part.makeBox(0.8, 0.2, 0.3)
    lp.translate(App.Vector(-15.0 - ad_w/2.0 - 0.8, PCB_Y + pcb_t, pin_z))
    ad_pins_list.append(lp)
    # Right pin
    rp = Part.makeBox(0.8, 0.2, 0.3)
    rp.translate(App.Vector(-15.0 + ad_w/2.0, PCB_Y + pcb_t, pin_z))
    ad_pins_list.append(rp)

ad_pins = ad_pins_list[0]
for p in ad_pins_list[1:]:
    ad_pins = ad_pins.fuse(p)
create_part(ad_pins, "AD5933_Pins", (0.8, 0.8, 0.85), group=pcb_group)

# OPA350 Chip (High-Speed Op-Amp)
# Body (Black plastic)
opa_w = 3.0
opa_d = 1.1
opa_h = 3.0
opa_body = Part.makeBox(opa_w, opa_d, opa_h)
opa_body.translate(App.Vector(15.0 - opa_w/2.0, PCB_Y + pcb_t, 50.0 - opa_h/2.0))
create_part(opa_body, "OPA350_Body", (0.15, 0.15, 0.15), group=pcb_group)

# OPA350 Pins (4 on each side)
opa_pins_list = []
for i in range(4):
    pin_z = 50.0 - opa_h/2.0 + 0.3 + i * 0.8
    # Left pin
    lp = Part.makeBox(0.6, 0.15, 0.25)
    lp.translate(App.Vector(15.0 - opa_w/2.0 - 0.6, PCB_Y + pcb_t, pin_z))
    opa_pins_list.append(lp)
    # Right pin
    rp = Part.makeBox(0.6, 0.15, 0.25)
    rp.translate(App.Vector(15.0 + opa_w/2.0, PCB_Y + pcb_t, pin_z))
    opa_pins_list.append(rp)

opa_pins = opa_pins_list[0]
for p in opa_pins_list[1:]:
    opa_pins = opa_pins.fuse(p)
create_part(opa_pins, "OPA350_Pins", (0.8, 0.8, 0.85), group=pcb_group)

# 15 SMD color-coded resistors/capacitors
smd_list = [
    (-15.0, 42.0, 'resistor', 'horizontal'),
    (-10.0, 42.0, 'capacitor', 'vertical'),
    (-20.0, 42.0, 'resistor', 'vertical'),
    (-15.0, 58.0, 'capacitor', 'horizontal'),
    (-10.0, 58.0, 'resistor', 'vertical'),
    (15.0, 42.0, 'resistor', 'horizontal'),
    (10.0, 42.0, 'capacitor', 'vertical'),
    (20.0, 42.0, 'resistor', 'vertical'),
    (15.0, 58.0, 'capacitor', 'horizontal'),
    (10.0, 58.0, 'resistor', 'vertical'),
    (-12.0, 92.0, 'resistor', 'horizontal'),
    (12.0, 92.0, 'capacitor', 'vertical'),
    (-5.0, 90.0, 'resistor', 'vertical'),
    (5.0, 90.0, 'capacitor', 'horizontal'),
    (0.0, 88.0, 'resistor', 'horizontal'),
]

for idx, (cx, cz, p_type, orientation) in enumerate(smd_list):
    w, d, h = 2.0, 0.85, 1.25  # standard 0805
    if orientation == 'vertical':
        w, h = h, w
        
    # main body
    body = Part.makeBox(w * 0.6, d, h)
    body.translate(App.Vector(cx - w*0.3, PCB_Y + pcb_t, cz - h/2.0))
    
    # end caps
    cap1 = Part.makeBox(w * 0.2, d + 0.05, h + 0.05)
    cap2 = Part.makeBox(w * 0.2, d + 0.05, h + 0.05)
    
    if orientation == 'horizontal':
        cap1.translate(App.Vector(cx - w/2.0, PCB_Y + pcb_t, cz - h/2.0 - 0.025))
        cap2.translate(App.Vector(cx + w/2.0 - w*0.2, PCB_Y + pcb_t, cz - h/2.0 - 0.025))
    else:
        cap1.translate(App.Vector(cx - w/2.0 - 0.025, PCB_Y + pcb_t, cz - h/2.0))
        cap2.translate(App.Vector(cx - w/2.0 - 0.025, PCB_Y + pcb_t, cz + h/2.0 - h*0.2))
        
    caps = cap1.fuse(cap2)
    
    # colors
    if p_type == 'resistor':
        body_color = (0.1, 0.1, 0.1) # black
        name_prefix = "SMD_Resistor"
    else:
        body_color = (0.6, 0.4, 0.25) # brown
        name_prefix = "SMD_Capacitor"
        
    create_part(body, f"{name_prefix}_{idx}_Body", body_color, group=pcb_group)
    create_part(caps, f"{name_prefix}_{idx}_Caps", (0.8, 0.8, 0.82), group=pcb_group)

# ==============================================================================
# 2. LiPo_Battery_Pack Group
# ==============================================================================
# Remove group if it exists
old_group = doc.getObject("LiPo_Battery_Pack")
if old_group is not None:
    doc.removeObject("LiPo_Battery_Pack")
bat_group = doc.addObject("App::DocumentObjectGroup", "LiPo_Battery_Pack")

bat_w = 34.0
bat_d = 6.0
bat_h = 42.0
bat_box = Part.makeBox(bat_w, bat_d, bat_h)
bat_box.translate(App.Vector(-bat_w/2.0, BAT_Y, 80.0))

# Fillet vertical edges
fillet_edges = []
for edge in bat_box.Edges:
    p1 = edge.Vertexes[0].Point
    p2 = edge.Vertexes[1].Point
    if abs(p1.x - p2.x) < 0.01 and abs(p1.y - p2.y) < 0.01:
        fillet_edges.append(edge)
try:
    bat_cell = bat_box.makeFillet(2.0, fillet_edges)
except Exception as e:
    print(f"Warning: Filleting battery cell failed, using raw block. Error: {e}")
    bat_cell = bat_box

create_part(bat_cell, "LiPo_Silver_Cell", (0.75, 0.75, 0.78), group=bat_group)

# PCM protection board strip
pcm_w = 34.0
pcm_d = 6.2
pcm_h = 3.0
pcm = Part.makeBox(pcm_w, pcm_d, pcm_h)
pcm.translate(App.Vector(-pcm_w/2.0, BAT_Y - 0.1, 122.0))
create_part(pcm, "PCM_Board_Strip", (0.1, 0.1, 0.1), group=bat_group)

# Wires (Red/Black cylinders)
black_wire = Part.makeCylinder(0.6, 12.0)
black_wire.translate(App.Vector(-4.0, BAT_Y + 3.0, 125.0))
create_part(black_wire, "Black_Wire", (0.1, 0.1, 0.1), group=bat_group)

red_wire = Part.makeCylinder(0.6, 12.0)
red_wire.translate(App.Vector(4.0, BAT_Y + 3.0, 125.0))
create_part(red_wire, "Red_Wire", (0.9, 0.1, 0.1), group=bat_group)

# ==============================================================================
# 3. LCD_Display_Module Group
# ==============================================================================
# Remove group if it exists
old_group = doc.getObject("LCD_Display_Module")
if old_group is not None:
    doc.removeObject("LCD_Display_Module")
lcd_group = doc.addObject("App::DocumentObjectGroup", "LCD_Display_Module")

# Black TFT bezel frame
bezel_outer = Part.makeBox(48.0, 1.2, 68.0)
bezel_outer.translate(App.Vector(-24.0, LCD_Y, 54.0))
bezel_cut = Part.makeBox(42.0, 2.0, 52.0)
bezel_cut.translate(App.Vector(-21.0, LCD_Y - 0.4, 62.0))
lcd_bezel_frame = bezel_outer.cut(bezel_cut)
create_part(lcd_bezel_frame, "TFT_Bezel_Frame", (0.05, 0.05, 0.05), group=lcd_group)

# Green LCD Screen Panel
lcd_panel = Part.makeBox(44.0, 1.0, 54.0)
lcd_panel.translate(App.Vector(-22.0, LCD_Y - 1.0, 61.0))
create_part(lcd_panel, "Green_LCD_Panel", (0.1, 0.5, 0.2), group=lcd_group)

# Semi-transparent screen glass
lcd_glass = Part.makeBox(46.0, 0.8, 55.0)
lcd_glass.translate(App.Vector(-23.0, LCD_Y + 0.6, 60.5))
create_part(lcd_glass, "Semi_Transparent_Glass", (0.7, 0.8, 0.95), transparency=50, group=lcd_group)

# Recompute document
doc.recompute()

# Save the document
print(f"Saving document to {fcstd_path}...")
doc.saveAs(fcstd_path)
print("RIOHS B4 Electronics Assembly generated and saved successfully!")
