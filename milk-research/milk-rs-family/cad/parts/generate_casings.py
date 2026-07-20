# -*- coding: utf-8 -*-
# ==============================================================================
# RIOHS B4 Casing Solid Modeling Script
# Constructs 3D models for Front_Housing_Shell and Rear_Housing_Shell.
#
# TECHNICAL READINESS LEVEL (TRL) DEMARCATION:
# TRL 1-2: Conceptual/Theoretical (Simulation models only. Physical parameters
# and structural features are calculated via mathematical models, NOT measured in lab).
# ==============================================================================

import os
import math
import FreeCAD as App
import Part

# Ensure target directory exists
save_dir = "d:/mariano/milk-research/milk-rs-family/cad/parts"
if not os.path.exists(save_dir):
    os.makedirs(save_dir)

print("Starting generation of RIOHS B4 casings...")

# 1. Initialize Document
doc = App.activeDocument()
if doc is None:
    doc = App.newDocument("RIOHS_B4_Casings_Assembly")

# --- Design Dimensions & Constants ---
CASE_W = 68.0    # Casing Width at bottom (X-axis)
CASE_D = 24.0    # Casing Depth at bottom (Y-axis)
CASE_H = 135.0   # Casing Height (Z-axis)
WALL_T = 2.5     # Casing Wall Thickness (2.5mm)
DRAFT_ANGLE = 1.5 # Casing draft angle in degrees

# Screen Bezel & LCD Panel Cutout
SCR_BEZEL_W = 50.0
SCR_BEZEL_H = 70.0
SCR_BEZEL_D = 2.0
SCR_LCD_W = 46.0
SCR_LCD_H = 55.0

# D-Pad Configuration
DPAD_R = 22.0
OK_BTN_R = 7.0

# Aux Button Configuration
AUX_BTN_W = 14.0
AUX_BTN_L = 8.0

# Bosses & Standoffs
BOSS_OUT_R = 4.0
BOSS_IN_R_FRONT = 1.1       # M2.2 self-tapping screw thread tap hole
BOSS_IN_R_REAR_CLEAR = 1.25 # M2.2 clearance hole
BOSS_H = 9.5                 # Meets exactly at Y=0 splitting plane (12.0 - 2.5)
PCB_STANDOFF_R = 2.5
PCB_STANDOFF_H = 4.0

# Corner Boss positions (X, Z)
corner_coords = [
    (-CASE_W/2.0 + 6.0, CASE_H - 8.0),
    (CASE_W/2.0 - 6.0, CASE_H - 8.0),
    (-CASE_W/2.0 + 6.0, 8.0),
    (CASE_W/2.0 - 6.0, 8.0)
]

# PCB mounting screw positions (X, Z)
pcb_screw_coords = [
    (-CASE_W/2.0 + 12.0, 75.0),
    (CASE_W/2.0 - 12.0, 75.0),
    (-CASE_W/2.0 + 12.0, 25.0),
    (CASE_W/2.0 - 12.0, 25.0)
]

# ==============================================================================
# Helper functions
# ==============================================================================
def create_part(shape, name, color=None):
    obj = doc.addObject("Part::Feature", name)
    obj.Shape = shape
    if color and hasattr(obj, "ViewObject") and obj.ViewObject is not None:
        try:
            obj.ViewObject.ShapeColor = color
        except Exception:
            pass
    return obj

# ==============================================================================
# Step 1: Generate outer drafted and filleted casing solid
# ==============================================================================
theta = math.radians(DRAFT_ANGLE)
t = CASE_H * math.tan(theta)
w_top = CASE_W - 2 * t
d_top = CASE_D - 2 * t

# Bottom wire (Z = 0)
p_b1 = App.Vector(-CASE_W/2.0, -CASE_D/2.0, 0.0)
p_b2 = App.Vector(CASE_W/2.0, -CASE_D/2.0, 0.0)
p_b3 = App.Vector(CASE_W/2.0, CASE_D/2.0, 0.0)
p_b4 = App.Vector(-CASE_W/2.0, CASE_D/2.0, 0.0)
p_b5 = App.Vector(-CASE_W/2.0, -CASE_D/2.0, 0.0)
wire_b = Part.makePolygon([p_b1, p_b2, p_b3, p_b4, p_b5])

# Top wire (Z = CASE_H)
p_t1 = App.Vector(-w_top/2.0, -d_top/2.0, CASE_H)
p_t2 = App.Vector(w_top/2.0, -d_top/2.0, CASE_H)
p_t3 = App.Vector(w_top/2.0, d_top/2.0, CASE_H)
p_t4 = App.Vector(-w_top/2.0, d_top/2.0, CASE_H)
p_t5 = App.Vector(-w_top/2.0, -d_top/2.0, CASE_H)
wire_t = Part.makePolygon([p_t1, p_t2, p_t3, p_t4, p_t5])

solid_loft = Part.makeLoft([wire_b, wire_t], True)

# Find vertical edges for outer solid
vertical_edges_outer = []
for edge in solid_loft.Edges:
    v1 = edge.Vertexes[0].Point
    v2 = edge.Vertexes[1].Point
    dz = abs(v1.z - v2.z)
    if dz > CASE_H - 1.0:
        vertical_edges_outer.append(edge)

outer_solid = solid_loft.makeFillet(5.0, vertical_edges_outer)

# ==============================================================================
# Step 2: Generate inner drafted and filleted cavity solid for shelling
# ==============================================================================
# Bottom of cavity (Z = WALL_T)
z_in_b = WALL_T
w_in_b = CASE_W - 2 * WALL_T * math.tan(theta) - 2 * WALL_T
d_in_b = CASE_D - 2 * WALL_T * math.tan(theta) - 2 * WALL_T

p_ib1 = App.Vector(-w_in_b/2.0, -d_in_b/2.0, z_in_b)
p_ib2 = App.Vector(w_in_b/2.0, -d_in_b/2.0, z_in_b)
p_ib3 = App.Vector(w_in_b/2.0, d_in_b/2.0, z_in_b)
p_ib4 = App.Vector(-w_in_b/2.0, d_in_b/2.0, z_in_b)
p_ib5 = App.Vector(-w_in_b/2.0, -d_in_b/2.0, z_in_b)
wire_ib = Part.makePolygon([p_ib1, p_ib2, p_ib3, p_ib4, p_ib5])

# Top of cavity (Z = CASE_H - WALL_T)
z_in_t = CASE_H - WALL_T
w_in_t = CASE_W - 2 * (CASE_H - WALL_T) * math.tan(theta) - 2 * WALL_T
d_in_t = CASE_D - 2 * (CASE_H - WALL_T) * math.tan(theta) - 2 * WALL_T

p_it1 = App.Vector(-w_in_t/2.0, -d_in_t/2.0, z_in_t)
p_it2 = App.Vector(w_in_t/2.0, -d_in_t/2.0, z_in_t)
p_it3 = App.Vector(w_in_t/2.0, d_in_t/2.0, z_in_t)
p_it4 = App.Vector(-w_in_t/2.0, d_in_t/2.0, z_in_t)
p_it5 = App.Vector(-w_in_t/2.0, -d_in_t/2.0, z_in_t)
wire_it = Part.makePolygon([p_it1, p_it2, p_it3, p_it4, p_it5])

inner_loft = Part.makeLoft([wire_ib, wire_it], True)

# Find vertical edges for inner solid
vertical_edges_inner = []
for edge in inner_loft.Edges:
    v1 = edge.Vertexes[0].Point
    v2 = edge.Vertexes[1].Point
    dz = abs(v1.z - v2.z)
    if dz > (CASE_H - 2 * WALL_T) - 1.0:
        vertical_edges_inner.append(edge)

inner_solid = inner_loft.makeFillet(2.5, vertical_edges_inner)

# Hollow the casing
hollow_casing = outer_solid.cut(inner_solid)

# ==============================================================================
# Step 3: Split casing at Y=0
# ==============================================================================
front_splitter = Part.makeBox(CASE_W + 20.0, CASE_D/2.0 + 10.0, CASE_H + 20.0)
front_splitter.translate(App.Vector(-CASE_W/2.0 - 10.0, 0.0, -10.0))
front_shell_raw = hollow_casing.common(front_splitter)

rear_splitter = Part.makeBox(CASE_W + 20.0, CASE_D/2.0 + 10.0, CASE_H + 20.0)
rear_splitter.translate(App.Vector(-CASE_W/2.0 - 10.0, -CASE_D/2.0 - 10.0, -10.0))
rear_shell_raw = hollow_casing.common(rear_splitter)

# ==============================================================================
# Step 4: Add Front Casing Features
# ==============================================================================
front_shell = front_shell_raw

# A. Bezel and Button pockets/holes
# Recessed LCD Bezel Pocket
bezel_pocket = Part.makeBox(SCR_BEZEL_W, 3.0, SCR_BEZEL_H)
bezel_pocket.translate(App.Vector(-SCR_BEZEL_W/2.0, CASE_D/2.0 - SCR_BEZEL_D, CASE_H - SCR_BEZEL_H - 12.0))
front_shell = front_shell.cut(bezel_pocket)

# Screen window cutout (extends all the way through the wall)
screen_window = Part.makeBox(SCR_LCD_W, 10.0, SCR_LCD_H)
screen_window.translate(App.Vector(-SCR_LCD_W/2.0, CASE_D/2.0 - 5.0, 60.5))
front_shell = front_shell.cut(screen_window)

# D-Pad recess
dpad_recess = Part.makeCylinder(DPAD_R, 2.0)
dpad_recess.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
dpad_recess.translate(App.Vector(0.0, CASE_D/2.0 - 1.5, 35.0))
front_shell = front_shell.cut(dpad_recess)

# D-Pad vertical slot
dpad_slot_v = Part.makeBox(10.0, 10.0, 34.0)
dpad_slot_v.translate(App.Vector(-5.0, CASE_D/2.0 - 5.0, 18.0))
front_shell = front_shell.cut(dpad_slot_v)

# D-Pad horizontal slot
dpad_slot_h = Part.makeBox(34.0, 10.0, 10.0)
dpad_slot_h.translate(App.Vector(-17.0, CASE_D/2.0 - 5.0, 30.0))
front_shell = front_shell.cut(dpad_slot_h)

# Central OK button hole
ok_hole = Part.makeCylinder(OK_BTN_R + 0.5, 10.0)
ok_hole.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
ok_hole.translate(App.Vector(0.0, CASE_D/2.0 - 5.0, 35.0))
front_shell = front_shell.cut(ok_hole)

# Left Aux (Menu) button slot
left_aux_hole = Part.makeBox(AUX_BTN_W + 0.8, 10.0, AUX_BTN_L + 0.8)
left_aux_hole.translate(App.Vector(-22.0, CASE_D/2.0 - 5.0, 12.0))
front_shell = front_shell.cut(left_aux_hole)

# Right Aux (Back) button slot
right_aux_hole = Part.makeBox(AUX_BTN_W + 0.8, 10.0, AUX_BTN_L + 0.8)
right_aux_hole.translate(App.Vector(22.0 - (AUX_BTN_W + 0.8), CASE_D/2.0 - 5.0, 12.0))
front_shell = front_shell.cut(right_aux_hole)

# B. Debossed logo 'RIOHS B4' on front face
# System font lookup
font_file = None
for f in ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/Calibri.ttf", "C:/Windows/Fonts/SegoeUI.ttf"]:
    if os.path.exists(f):
        font_file = f
        break

if font_file:
    try:
        import Draft
        ss = Draft.make_shapestring("RIOHS B4", font_file, 8.0)
        ss_shape = ss.Shape.copy()
        bbox = ss_shape.BoundBox
        text_w = bbox.XMax - bbox.XMin
        ss_shape.translate(App.Vector(-bbox.XMin - text_w/2.0, -bbox.YMin, 0.0))
        
        # Extrude text
        text_solid = ss_shape.extrude(App.Vector(0, 0, 1.0))
        text_solid.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
        text_solid.translate(App.Vector(0.0, CASE_D/2.0 + 0.5, 115.0))
        
        # Cut text deboss
        front_shell = front_shell.cut(text_solid)
        doc.removeObject(ss.Name)
        print("Logo shape string generated and debossed successfully.")
    except Exception as e:
        print("Failed to generate shape string:", str(e))
        # Fallback to simple rectangular plate recess
        logo_recess = Part.makeBox(35.0, 0.5, 8.0)
        logo_recess.translate(App.Vector(-17.5, CASE_D/2.0 - 0.5, 111.0))
        front_shell = front_shell.cut(logo_recess)
        print("Logo fallback recess debossed.")
else:
    # Fallback to simple rectangular plate recess
    logo_recess = Part.makeBox(35.0, 0.5, 8.0)
    logo_recess.translate(App.Vector(-17.5, CASE_D/2.0 - 0.5, 111.0))
    front_shell = front_shell.cut(logo_recess)
    print("Logo fallback recess debossed.")

# C. Corner Screw Bosses with Vertical Support Ribs
def make_boss_with_ribs(cx, cz, is_front):
    # Boss cylinder
    outer_cyl = Part.makeCylinder(BOSS_OUT_R, BOSS_H)
    outer_cyl.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
    
    in_r = BOSS_IN_R_FRONT if is_front else BOSS_IN_R_REAR_CLEAR
    inner_cyl = Part.makeCylinder(in_r, BOSS_H + 1.0)
    inner_cyl.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
    
    boss_single = outer_cyl.cut(inner_cyl)
    
    if is_front:
        y_pos = CASE_D/2.0 - WALL_T
        boss_single.translate(App.Vector(cx, y_pos, cz))
        y_start_rib = CASE_D/2.0 - WALL_T - BOSS_H
    else:
        y_pos = 0.0
        boss_single.translate(App.Vector(cx, y_pos, cz))
        y_start_rib = -CASE_D/2.0 + WALL_T
        
    # Rib X (horizontal support web)
    t_cz = cz * math.tan(theta)
    w_inner_cz = CASE_W - 2 * t_cz - 2 * WALL_T
    
    if cx < 0:
        rx_w = cx - (-w_inner_cz / 2.0)
        rx_x = -w_inner_cz / 2.0
    else:
        rx_w = (w_inner_cz / 2.0) - cx
        rx_x = cx
    rib_x = Part.makeBox(rx_w, BOSS_H, 1.5)
    rib_x.translate(App.Vector(rx_x, y_start_rib, cz - 0.75))
    
    # Rib Z (vertical support web)
    if cz > CASE_H/2.0:
        rz_h = (CASE_H - WALL_T) - cz
        rz_z = cz
    else:
        rz_h = cz - WALL_T
        rz_z = WALL_T
    rib_z = Part.makeBox(1.5, BOSS_H, rz_h)
    rib_z.translate(App.Vector(cx - 0.75, y_start_rib, rz_z))
    
    boss_assembly = boss_single.fuse(rib_x).fuse(rib_z)
    return boss_assembly

for cx, cz in corner_coords:
    boss = make_boss_with_ribs(cx, cz, is_front=True)
    front_shell = front_shell.fuse(boss)

# Trim bosses to inner/outer shape
front_shell = front_shell.common(outer_solid)
front_shell = front_shell.common(front_splitter)

# ==============================================================================
# Step 5: Add Rear Casing Features
# ==============================================================================
rear_shell = rear_shell_raw

# A. Corner Bosses
for cx, cz in corner_coords:
    boss = make_boss_with_ribs(cx, cz, is_front=False)
    rear_shell = rear_shell.fuse(boss)

# Trim bosses to rear shape
rear_shell = rear_shell.common(outer_solid)
rear_shell = rear_shell.common(rear_splitter)

# B. Clearance Holes and Counterbores for M2.2 screws through the back wall
for cx, cz in corner_coords:
    # Clearance hole
    hole = Part.makeCylinder(BOSS_IN_R_REAR_CLEAR, 6.0)
    hole.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
    hole.translate(App.Vector(cx, -CASE_D/2.0 + 6.0, cz))
    
    # Counterbore for screw head
    cb = Part.makeCylinder(2.2, 2.0)
    cb.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
    cb.translate(App.Vector(cx, -CASE_D/2.0 + 1.2, cz))
    
    rear_shell = rear_shell.cut(hole).cut(cb)

# C. PCB Mount Standoffs (4 standoffs)
for sx, sz in pcb_screw_coords:
    st_outer = Part.makeCylinder(PCB_STANDOFF_R, PCB_STANDOFF_H)
    st_outer.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
    st_outer.translate(App.Vector(sx, -CASE_D/2.0 + WALL_T + PCB_STANDOFF_H, sz))
    
    st_inner = Part.makeCylinder(1.0, PCB_STANDOFF_H + 1.0)
    st_inner.rotate(App.Vector(0,0,0), App.Vector(1,0,0), 90.0)
    st_inner.translate(App.Vector(sx, -CASE_D/2.0 + WALL_T + PCB_STANDOFF_H, sz))
    
    standoff = st_outer.cut(st_inner)
    rear_shell = rear_shell.fuse(standoff)

# D. Ribbed Battery Bracket (ABS features to hold LiPo pack)
battery_bracket_l = Part.makeBox(1.5, 6.0, 40.0)
battery_bracket_l.translate(App.Vector(-18.0, -CASE_D/2.0 + WALL_T, 80.0))

battery_bracket_r = Part.makeBox(1.5, 6.0, 40.0)
battery_bracket_r.translate(App.Vector(16.5, -CASE_D/2.0 + WALL_T, 80.0))

battery_holder = battery_bracket_l.fuse(battery_bracket_r)

# Horizontal anti-slip ribs on the back casing inside wall for battery pack
for i in range(3):
    rib_z = 85.0 + i * 12.0
    rib = Part.makeBox(36.0, 1.5, 2.0)
    rib.translate(App.Vector(-18.0, -CASE_D/2.0 + WALL_T, rib_z))
    battery_holder = battery_holder.fuse(rib)

rear_shell = rear_shell.fuse(battery_holder)

# Final trim for safety
rear_shell = rear_shell.common(outer_solid)
rear_shell = rear_shell.common(rear_splitter)

# ==============================================================================
# Step 6: Create Document Features & Save Document
# ==============================================================================
create_part(front_shell, "Front_Housing_Shell", (0.12, 0.12, 0.15))
create_part(rear_shell, "Rear_Housing_Shell", (0.12, 0.12, 0.15))

doc.recompute()
save_path = os.path.join(save_dir, "casings_assembly.FCStd")
doc.saveAs(save_path)

print(f"Casing models successfully generated and saved to {save_path}!")
