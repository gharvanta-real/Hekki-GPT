# -*- coding: utf-8 -*-
# ==============================================================================
# RIOHS B4 Milk Tester: Mechanical Components CAD Model Generator
# Generates 3D models for:
# - DPad_Silicone_Pad
# - OK_Keycap (with bottom lip and side locking flanges)
# - Menu_Keycap & Back_Keycap (with bottom lip and locking flanges)
# - Left_Rubber_Grip & Right_Rubber_Grip (with 12 horizontal anti-slip grooves)
# - Probe_Base_ABS_Housing
# - Left_EC_Electrode_Pin
# - Right_Optical_Electrode_Pin (with 5-degree tilted sapphire window cut)
# - Assembly Screws (4 M2.2 screws with hexagonal socket drive and helical thread sweeps)
#
# Technology Readiness Level (TRL) Demarcation:
# - TRL 1-2: Conceptual/Theoretical (Calculated via simulation models; NOT measured in lab).
# - This CAD geometry represents a computational design layout. Material properties,
#   dimensions, and mechanical tolerances specified herein must be verified via
#   empirical lab testing before manufacturing.
#
# Required Verification Methods / Testing Protocols:
# | Property Class                  | Testing Protocol / Standard |
# | :----------------------------- | :------------------------- |
# | ABS / Silicone / TPE Hardness  | Durometer Shore A/D hardness under ASTM D2240 |
# | Tensile Strength (ABS/Steel)   | UTM Mechanical Tensile Test under ASTM D638 / ASTM E8 |
# | Glass Transition Temp (ABS)    | DSC Thermogram under ASTM D3418 |
# ==============================================================================

import os
import math
import FreeCAD as App
import Part

print("Constructing RIOHS B4 Mechanical Parts Assembly (TRL 1-2)...")

# Initialize clean document
doc = App.newDocument("RIOHS_B4_Mechanical_Assembly")

# --- Design Dimensions & Constants ---
CASE_W = 68.0    # Casing Width (X-axis)
CASE_D = 24.0    # Casing Depth (Y-axis)
CASE_H = 135.0   # Casing Height (Z-axis)
WALL_T = 2.5     # Casing Wall Thickness (2.5mm)

# Grips / Bumpers (TPE)
BMP_W = 4.0
BMP_D = 26.0
BMP_H = 110.0

# Probe Pins & Connector
PROBE_R = 2.5
PROBE_L = 30.0

# Keypad & Buttons (Silicone & Plastic)
OK_BTN_R = 7.0
AUX_BTN_W = 14.0
AUX_BTN_L = 8.0

# M2.2 Screws Dimensions
M2_2_NOMINAL_R = 1.1
M2_2_PITCH = 0.45
M2_2_DEPTH = 0.2
M2_2_SHANK_H = 8.0
M2_2_THREAD_H = 6.0
M2_2_HEAD_R = 2.0
M2_2_HEAD_H = 1.5

# Helper function to register and color code parts in the tree view
# Protects ViewObject access since it is None in non-GUI console mode (freecadcmd.exe)
def create_part(shape, name, color=None, transparency=0):
    obj = doc.addObject("Part::Feature", name)
    obj.Shape = shape
    if obj.ViewObject is not None:
        if color:
            obj.ViewObject.ShapeColor = color
        if transparency > 0:
            obj.ViewObject.Transparency = transparency
    return obj

# ==============================================================================
# 1. KEYPAD ASSEMBLY (Silicone and Button Keycaps)
# ==============================================================================

# A. DPad_Silicone_Pad
# Realistic silicone rubber pad featuring:
# - Thin circular membrane base disk (22.0mm radius, 1.0mm thickness)
# - Raised D-Pad cross on front (thickness 2.0mm, width 34.0mm)
# - 4 raised contact domes on the back (2.0mm radius, 1.0mm height)
# - Central clearance cutout hole (7.5mm radius) for the OK button
membrane = Part.makeCylinder(22.0, 1.0)
membrane.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0) # rotate to face Y
membrane.translate(App.Vector(0.0, 11.0, 35.0)) # Center at X=0, Y=11, Z=35

cross_h = Part.makeBox(34.0, 2.0, 10.0)
cross_h.translate(App.Vector(-17.0, 11.0, 30.0))
cross_v = Part.makeBox(10.0, 2.0, 34.0)
cross_v.translate(App.Vector(-5.0, 11.0, 18.0))
cross = cross_h.fuse(cross_v)
pad_fused = membrane.fuse(cross)

dome_r = 2.0
dome_h = 1.0
dome1 = Part.makeCylinder(dome_r, dome_h)
dome1.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
dome1.translate(App.Vector(0, 10.0, 50.0))

dome2 = Part.makeCylinder(dome_r, dome_h)
dome2.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
dome2.translate(App.Vector(0, 10.0, 20.0))

dome3 = Part.makeCylinder(dome_r, dome_h)
dome3.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
dome3.translate(App.Vector(15.0, 10.0, 35.0))

dome4 = Part.makeCylinder(dome_r, dome_h)
dome4.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
dome4.translate(App.Vector(-15.0, 10.0, 35.0))

domes = dome1.fuse(dome2).fuse(dome3).fuse(dome4)
pad_with_domes = pad_fused.fuse(domes)

ok_hole = Part.makeCylinder(7.5, 5.0)
ok_hole.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
ok_hole.translate(App.Vector(0.0, 9.5, 35.0))

dpad_silicone_pad = pad_with_domes.cut(ok_hole)
create_part(dpad_silicone_pad, "DPad_Silicone_Pad", (0.35, 0.35, 0.38))

# B. OK_Keycap
# Core center select key featuring:
# - Cylindrical button cap body (7.0mm radius, 3.0mm thickness)
# - Continuous bottom retaining lip / flange (8.0mm radius, 1.0mm thickness)
# - Side locking tabs (flanges) extending along X axis to prevent rotation and displacement
ok_cap = Part.makeCylinder(OK_BTN_R, 3.0)
ok_cap.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
ok_cap.translate(App.Vector(0.0, 15.0, 35.0))

ok_flange = Part.makeCylinder(OK_BTN_R + 1.0, 1.0)
ok_flange.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
ok_flange.translate(App.Vector(0.0, 12.0, 35.0))

tab_l = Part.makeBox(2.5, 1.0, 2.0)
tab_l.translate(App.Vector(-9.5, 11.0, 34.0))
tab_r = Part.makeBox(2.5, 1.0, 2.0)
tab_r.translate(App.Vector(7.0, 11.0, 34.0))

ok_keycap = ok_cap.fuse(ok_flange).fuse(tab_l).fuse(tab_r)
create_part(ok_keycap, "OK_Keycap", (1.0, 0.48, 0.0))

# C. Menu_Keycap
# Auxiliary navigation key cap featuring:
# - Rectangular keycap body (14.0mm X-width, 3.0mm Y-height, 8.0mm Z-length)
# - Bottom flange lip (15.6mm X-width, 1.0mm Y-height, 9.6mm Z-length)
# - Small end locking tabs for seat engagement
menu_cap = Part.makeBox(AUX_BTN_W, 3.0, AUX_BTN_L)
menu_cap.translate(App.Vector(-21.6, 12.0, 12.4))

menu_flange = Part.makeBox(AUX_BTN_W + 1.6, 1.0, AUX_BTN_L + 1.6)
menu_flange.translate(App.Vector(-22.4, 11.0, 11.6))

mtab_l = Part.makeBox(1.5, 1.0, 2.0)
mtab_l.translate(App.Vector(-23.9, 11.0, 15.4))
mtab_r = Part.makeBox(1.5, 1.0, 2.0)
mtab_r.translate(App.Vector(-7.6, 11.0, 15.4))

menu_keycap = menu_cap.fuse(menu_flange).fuse(mtab_l).fuse(mtab_r)
create_part(menu_keycap, "Menu_Keycap", (0.3, 0.3, 0.32))

# D. Back_Keycap
# Auxiliary cancellation key cap matching the menu keycap profile:
back_cap = Part.makeBox(AUX_BTN_W, 3.0, AUX_BTN_L)
back_cap.translate(App.Vector(7.6, 12.0, 12.4))

back_flange = Part.makeBox(AUX_BTN_W + 1.6, 1.0, AUX_BTN_L + 1.6)
back_flange.translate(App.Vector(6.8, 11.0, 11.6))

btab_l = Part.makeBox(1.5, 1.0, 2.0)
btab_l.translate(App.Vector(5.3, 11.0, 15.4))
btab_r = Part.makeBox(1.5, 1.0, 2.0)
btab_r.translate(App.Vector(21.6, 11.0, 15.4))

back_keycap = back_cap.fuse(back_flange).fuse(btab_l).fuse(btab_r)
create_part(back_keycap, "Back_Keycap", (0.3, 0.3, 0.32))


# ==============================================================================
# 2. RUBBER GRIPS / BUMPERS
# ==============================================================================

# A. Left_Rubber_Grip
# Protective side overmold featuring 12 horizontal anti-slip ridges
left_grip = Part.makeBox(BMP_W, BMP_D, BMP_H)
left_grip.translate(App.Vector(-CASE_W/2.0 - BMP_W, -BMP_D/2.0, 12.0))
for i in range(12):
    ridge_z = 20.0 + (i * 7.0)
    rc = Part.makeBox(BMP_W + 1.0, 2.0, 2.0)
    rc.translate(App.Vector(-CASE_W/2.0 - BMP_W - 0.5, -1.0, ridge_z))
    left_grip = left_grip.cut(rc)
create_part(left_grip, "Left_Rubber_Grip", (1.0, 0.48, 0.0))

# B. Right_Rubber_Grip
# Protective side overmold matching the left profile
right_grip = Part.makeBox(BMP_W, BMP_D, BMP_H)
right_grip.translate(App.Vector(CASE_W/2.0, -BMP_D/2.0, 12.0))
for i in range(12):
    ridge_z = 20.0 + (i * 7.0)
    rc = Part.makeBox(BMP_W + 1.0, 2.0, 2.0)
    rc.translate(App.Vector(CASE_W/2.0 - 0.5, -1.0, ridge_z))
    right_grip = right_grip.cut(rc)
create_part(right_grip, "Right_Rubber_Grip", (1.0, 0.48, 0.0))


# ==============================================================================
# 3. SENSING PROBE MODULE
# ==============================================================================

# A. Probe_Base_ABS_Housing
# The connector block seating both probe electrodes
probe_base = Part.makeBox(36.0, 12.0, 6.0)
probe_base.translate(App.Vector(-18.0, -6.0, -6.0))
create_part(probe_base, "Probe_Base_ABS_Housing", (0.1, 0.1, 0.1))

# B. Left_EC_Electrode_Pin
# Stainless steel electrical conductivity electrode contact pin
left_pin = Part.makeCylinder(PROBE_R, PROBE_L)
left_pin.translate(App.Vector(-12.0, 0.0, -PROBE_L - 6.0))
create_part(left_pin, "Left_EC_Electrode_Pin", (0.8, 0.8, 0.85))

# C. Right_Optical_Electrode_Pin
# Stainless steel optical housing electrode pin featuring a 5-degree tilted sapphire window pocket
right_pin = Part.makeCylinder(PROBE_R, PROBE_L)
right_pin.translate(App.Vector(12.0, 0.0, -PROBE_L - 6.0))

window_slot = Part.makeCylinder(1.5, 4.0)
window_slot.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 95.0) # 5-degree tilt relative to vertical (90 deg)
window_slot.translate(App.Vector(12.0, 0.0, -PROBE_L - 2.0))
right_pin_final = right_pin.cut(window_slot)
create_part(right_pin_final, "Right_Optical_Electrode_Pin", (0.8, 0.8, 0.85))


# ==============================================================================
# 4. ASSEMBLY SCREWS (M2.2 Helical Sweep Screws)
# ==============================================================================

# Helper function to generate an M2.2 screw with true helical threads
def make_m2_2_screw(cx, cz):
    # Head: cylinder
    head = Part.makeCylinder(M2_2_HEAD_R, M2_2_HEAD_H)
    
    # Hex socket drive
    hex_r = 1.0
    pts = []
    for i in range(7):
        angle = math.radians(i * 60)
        pts.append(App.Vector(hex_r * math.cos(angle), hex_r * math.sin(angle), M2_2_HEAD_H - 1.0))
    hex_wire = Part.makePolygon(pts)
    hex_face = Part.Face(hex_wire)
    hex_drive = hex_face.extrude(App.Vector(0, 0, 1.2))
    head_with_drive = head.cut(hex_drive)
    
    # Core shank cylinder
    core = Part.makeCylinder(M2_2_NOMINAL_R - M2_2_DEPTH, M2_2_SHANK_H)
    core.translate(App.Vector(0, 0, -M2_2_SHANK_H))
    
    # Helical Thread
    thread = Part.makeThread(M2_2_PITCH, M2_2_DEPTH, M2_2_THREAD_H, M2_2_NOMINAL_R)
    thread.translate(App.Vector(0, 0, -M2_2_THREAD_H))
    
    # Fuse shank parts and head
    shank = core.fuse(thread)
    screw = shank.fuse(head_with_drive)
    
    # Rotate 90 degrees around X axis to align with the Y direction (facing from back of device)
    screw.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
    
    # Translate to boss center
    screw.translate(App.Vector(cx, -10.5, cz))
    return screw

# M2.2 corner locations
corner_coords = [
    (-CASE_W/2.0 + 6.0, CASE_H - 8.0),
    (CASE_W/2.0 - 6.0, CASE_H - 8.0),
    (-CASE_W/2.0 + 6.0, 8.0),
    (CASE_W/2.0 - 6.0, 8.0)
]

screw_names = ["Screw_Top_Left", "Screw_Top_Right", "Screw_Bottom_Left", "Screw_Bottom_Right"]
for i, (cx, cz) in enumerate(corner_coords):
    screw_shape = make_m2_2_screw(cx, cz)
    create_part(screw_shape, screw_names[i], (0.7, 0.7, 0.72))

# ==============================================================================
# SAVE DOCUMENT
# ==============================================================================
doc.recompute()
out_dir = "d:/mariano/milk-research/milk-rs-family/cad/parts/"
os.makedirs(out_dir, exist_ok=True)
output_path = os.path.join(out_dir, "mechanicals_assembly.FCStd")
doc.saveAs(output_path)

print("RIOHS B4 Mechanical Parts generated successfully!")
print("Saved to:", output_path)
