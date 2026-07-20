#version 3.7; // 3.6
global_settings { assumed_gamma 1.0 }
#default { finish { ambient 0.2 diffuse 0.9 } }
#default { pigment { rgb <0.678, 0.710, 0.741> } }

//------------------------------------------
#include "colors.inc"
#include "textures.inc"

//------------------------------------------
#include "riohs_b4_final_assembly_textures.inc"
#include "riohs_b4_final_assembly_meshes.inc"

//------------------------------------------
// Camera ----------------------------------
#declare CamUp = < 0, 0, 76.21>;
#declare CamRight = <101.61, 0, 0>;
#declare CamRotation = <0.0, 0.0, 180.0>;
#declare CamPosition = <-22.9520320892334, 363.32904052734375, 139.11856079101562>;
camera {
	orthographic
	location <0, 0, 0>
	direction <0, 1, 0>
	up CamUp
	right CamRight
	rotate CamRotation
	translate CamPosition
}

// FreeCAD Light -------------------------------------
light_source { CamPosition color rgb <0.5, 0.5, 0.5> }

// Background ------------------------------

polygon {
	5, <-50.80730692545573, -38.1054801940918>, <-50.80730692545573, 38.1054801940918>, <50.80730692545573, 38.1054801940918>, <50.80730692545573, -38.1054801940918>, <-50.80730692545573, -38.1054801940918>
	pigment { color rgb<0.969, 0.969, 0.969> }
	finish { ambient 1 diffuse 0 }
	rotate <90.0, 0.0, 180.0>
	translate <-22.9520320892334, 363.32904052734375, 139.11856079101562>
	translate <-0.0, -100000.0, 0.0>
}
sky_sphere {
	pigment {
		color rgb<0.969, 0.969, 0.969>
	}
}

//------------------------------------------

#include "riohs_b4_final_assembly_user.inc"

// Objects in Scene ------------------------

//----- Front_Housing_Shell -----
object { Front_Housing_Shell_mesh
		pigment { color rgb <0.098, 0.098, 0.110> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Rear_Housing_Shell -----
object { Rear_Housing_Shell_mesh
		pigment { color rgb <0.098, 0.098, 0.110> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- USB_C_Port_Shell -----
object { USB_C_Port_Shell_mesh
		pigment { color rgb <0.706, 0.706, 0.745> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- USB_C_Internal_Tongue -----
object { USB_C_Internal_Tongue_mesh
		pigment { color rgb <0.078, 0.078, 0.078> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- MicroSD_Card_Slot -----
object { MicroSD_Card_Slot_mesh
		pigment { color rgb <0.471, 0.471, 0.510> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- MicroSD_Door_Cover -----
object { MicroSD_Door_Cover_mesh
		pigment { color rgb <0.157, 0.157, 0.176> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- DPad_Silicone_Pad -----
object { DPad_Silicone_Pad_mesh
		pigment { color rgb <0.235, 0.235, 0.255> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- OK_Keycap -----
object { OK_Keycap_mesh
		pigment { color rgb <0.941, 0.392, 0.000> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Menu_Button -----
object { Menu_Button_mesh
		pigment { color rgb <0.235, 0.235, 0.255> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Back_Button -----
object { Back_Button_mesh
		pigment { color rgb <0.235, 0.235, 0.255> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Select_Button -----
object { Select_Button_mesh
		pigment { color rgb <0.235, 0.235, 0.255> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Power_Button -----
object { Power_Button_mesh
		pigment { color rgb <0.863, 0.078, 0.078> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Left_Grip -----
object { Left_Grip_mesh
		pigment { color rgb <0.941, 0.392, 0.000> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Right_Grip -----
object { Right_Grip_mesh
		pigment { color rgb <0.941, 0.392, 0.000> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Probe_ABS_Connector_Block -----
object { Probe_ABS_Connector_Block_mesh
		pigment { color rgb <0.059, 0.059, 0.059> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Left_EC_Electrode_Pin_SS316 -----
object { Left_EC_Electrode_Pin_SS316_mesh
		pigment { color rgb <0.784, 0.804, 0.843> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Right_Optical_Electrode_Pin_SS316 -----
object { Right_Optical_Electrode_Pin_SS316_mesh
		pigment { color rgb <0.784, 0.804, 0.843> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- ESP32_S3_PCB_FR4 -----
object { ESP32_S3_PCB_FR4_mesh
		pigment { color rgb <0.059, 0.471, 0.118> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- ESP32_S3_Shield -----
object { ESP32_S3_Shield_mesh
		pigment { color rgb <0.706, 0.706, 0.745> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- ESP32_Antenna -----
object { ESP32_Antenna_mesh
		pigment { color rgb <0.059, 0.059, 0.078> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- AD5933_IC -----
object { AD5933_IC_mesh
		pigment { color rgb <0.118, 0.118, 0.137> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- OPA350_IC -----
object { OPA350_IC_mesh
		pigment { color rgb <0.118, 0.118, 0.137> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- USB_C_PCB_Footprint -----
object { USB_C_PCB_Footprint_mesh
		pigment { color rgb <0.667, 0.667, 0.706> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- SMD_Resistor_0 -----
object { SMD_Resistor_0_mesh
		pigment { color rgb <0.078, 0.078, 0.078> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- SMD_Capacitor_0 -----
object { SMD_Capacitor_0_mesh
		pigment { color rgb <0.510, 0.431, 0.235> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- SMD_Resistor_1 -----
object { SMD_Resistor_1_mesh
		pigment { color rgb <0.078, 0.078, 0.078> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- SMD_Capacitor_1 -----
object { SMD_Capacitor_1_mesh
		pigment { color rgb <0.510, 0.431, 0.235> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- SMD_Resistor_2 -----
object { SMD_Resistor_2_mesh
		pigment { color rgb <0.078, 0.078, 0.078> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- SMD_Capacitor_2 -----
object { SMD_Capacitor_2_mesh
		pigment { color rgb <0.510, 0.431, 0.235> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- SMD_Resistor_3 -----
object { SMD_Resistor_3_mesh
		pigment { color rgb <0.078, 0.078, 0.078> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- SMD_Capacitor_3 -----
object { SMD_Capacitor_3_mesh
		pigment { color rgb <0.510, 0.431, 0.235> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- LiPo_Battery_1200mAh -----
object { LiPo_Battery_1200mAh_mesh
		pigment { color rgb <0.784, 0.706, 0.078> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- PCM_Protection_Board -----
object { PCM_Protection_Board_mesh
		pigment { color rgb <0.059, 0.059, 0.059> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Bat_Wire_Red -----
object { Bat_Wire_Red_mesh
		pigment { color rgb <0.863, 0.059, 0.059> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Bat_Wire_Blk -----
object { Bat_Wire_Blk_mesh
		pigment { color rgb <0.059, 0.059, 0.059> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- TFT_Bezel_Frame -----
object { TFT_Bezel_Frame_mesh
		pigment { color rgb <0.039, 0.039, 0.039> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- LCD_Screen_Glass -----
object { LCD_Screen_Glass_mesh
		pigment { color rgb <0.118, 0.706, 0.118> transmit 0.35 }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Front_Boss_TL -----
object { Front_Boss_TL_mesh
		pigment { color rgb <0.157, 0.157, 0.176> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Front_Boss_TR -----
object { Front_Boss_TR_mesh
		pigment { color rgb <0.157, 0.157, 0.176> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Front_Boss_BL -----
object { Front_Boss_BL_mesh
		pigment { color rgb <0.157, 0.157, 0.176> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Front_Boss_BR -----
object { Front_Boss_BR_mesh
		pigment { color rgb <0.157, 0.157, 0.176> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Screw_TL -----
object { Screw_TL_mesh
		pigment { color rgb <0.627, 0.627, 0.667> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Screw_TR -----
object { Screw_TR_mesh
		pigment { color rgb <0.627, 0.627, 0.667> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Screw_BL -----
object { Screw_BL_mesh
		pigment { color rgb <0.627, 0.627, 0.667> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Screw_BR -----
object { Screw_BR_mesh
		pigment { color rgb <0.627, 0.627, 0.667> }
finish {
	ambient rgb<0.333, 0.333, 0.333>
	emission rgb<0.000, 0.000, 0.000>
	phong 0.53 phong_size 44.999998807907104 
}

}

//----- Body -----
//----- X_axis -----
//----- Y_axis -----
//----- Z_axis -----
//----- XY_plane -----
//----- XZ_plane -----
//----- YZ_plane -----
//----- Origin001 -----