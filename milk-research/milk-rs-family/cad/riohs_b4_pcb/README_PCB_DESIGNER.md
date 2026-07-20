# 📐 RIOHS B4 Milk Tester Motherboard - PCB Designer Handoff Guide

**Project Name:** RIOHS B4 Milk Analyzer Motherboard Prototype V1  
**Target KiCad Version:** KiCad v8 / v10 Compatible  
**Manufacturer Standard:** JLCPCB / Local PCBA Compatible (0603 SMD Passives, 4-Layer FR4)

---

## 📁 Package Contents & File Structure

This folder contains the complete 10-sheet hierarchical architecture, Component BOM with LCSC part numbers, Netlist, and Board Outline for the RIOHS B4 Motherboard.

| File / Folder | Description |
| :--- | :--- |
| **`riohs_b4_pcb.kicad_sch`** | **Master Root Schematic File** (Hierarchical tree linking Sheets 1–10) |
| **`power_system.kicad_sch`** | Sheet 1: USB-C, TP4056 Charger, DW01A Protection, AP2112K 3.3V LDO |
| **`esp32_core.kicad_sch`** | Sheet 2: ESP32-S3-WROOM-1-N8R2 MCU, EN/BOOT buttons, decoupling |
| **`usb_uart.kicad_sch`** | Sheet 3: CH340C USB-UART bridge with auto-flash NPN transistors |
| **`optical_front_end.kicad_sch`** | Sheet 4: 940nm NIR LED emitter, PIN Photodiodes, TLV9062 TIA Amplifiers |
| **`ec_measurement.kicad_sch`** | Sheet 5: AD5933 Impedance Analyzer, TLV9062 Excitation buffer, AC coupling |
| **`temperature_sensor.kicad_sch`** | Sheet 6: NTC Thermistor interface, filter cap, ADC divider |
| **`display_ui.kicad_sch`** | Sheet 7: 1.8" SPI TFT header, MOSFET Backlight driver, 5 D-Pad buttons |
| **`piezo_driver.kicad_sch`** | Sheet 8: Active Buzzer MOSFET driver, Schottky flyback protection |
| **`external_connectors.kicad_sch`** | Sheet 9: Debug UART/I2C/SPI headers, SRV05-4 ESD protection arrays |
| **`manufacturing.kicad_sch`** | Sheet 10: 4x M3 Grounded Mounting Holes, 3x Pick-and-Place Fiducials |
| **`riohs_b4_bom.csv`** | **Complete Bill of Materials (BOM)** with verified LCSC C-Part Numbers |
| **`riohs_b4_cpl.csv`** | Pick-and-Place Centroid Coordinates file |
| **`riohs_b4_pcb.net`** | Complete Netlist Export |
| **`riohs_b4_pcb.kicad_pcb`** | PCB Layout file (100mm x 60mm Edge.Cuts, mounting holes, and floorplan) |

---

## 🛠️ Instructions for the PCB Designer

### What is Already Completed:
1. **Component Selection & BOM Freeze:** All passives, ICs, connectors, and switches have verified footprints and **LCSC Part Numbers** assigned.
2. **Sheet Architecture & Placement:** All components are placed on their respective 10 subsheets in KiCad.
3. **Board Outline & Floorplan:** Mechanical dimensions (100mm x 60mm), M3 mounting holes, optical fiducials, and component placements are initialized inside `riohs_b4_pcb.kicad_pcb`.

### Tasks Required to Complete the PCB:
1. **Schematic Wiring:**
   * Open `riohs_b4_pcb.kicad_sch` in KiCad Eeschema.
   * Draw the visual wire connections (`W` shortcut) and connect power ports (`+3.3V`, `GND`, `VBAT_SYS`, `VBUS`) on each subsheet as per the net specs below.
2. **Run ERC (Electrical Rules Check):** Resolve any floating pins or unflagged power rails.
3. **PCB Trace Routing & DRC:**
   * Route power rails (`VBUS`, `VBAT`, `3.3V`) using $\ge 0.5\text{ mm}$ width traces.
   * Route USB `D+`/`D-` as a $90\ \Omega$ differential pair.
   * Fill Inner Layer 2 as a solid `GND` copper plane.
   * Keep photodiode TIA traces (Sheet 4) as short as possible to minimize noise.
4. **Gerber & Manufacturing Package Export:** Export standard Gerbers (RS-274X) + Excellon drill files for JLCPCB / PCBA submission.

---

## 📌 Critical Pin Connections Reference

* **SPI Display (Sheet 7):**
  * `TFT_SCLK` -> ESP32-S3 `GPIO10`
  * `TFT_MOSI` -> ESP32-S3 `GPIO11`
  * `TFT_CS`   -> ESP32-S3 `GPIO9`
  * `TFT_DC`   -> ESP32-S3 `GPIO13`
  * `TFT_RST`  -> ESP32-S3 `GPIO14`
  * `TFT_BL`   -> ESP32-S3 `GPIO21` (PWM Backlight)
* **Optical Front End (Sheet 4):**
  * `OPT_TRIGGER` -> ESP32-S3 `GPIO12`
  * `OP_MAIN_OUT` -> ESP32-S3 `GPIO5` (ADC1_CH4)
  * `OP_REF_OUT`  -> ESP32-S3 `GPIO6` (ADC1_CH5)
* **EC / Conductivity (Sheet 5):**
  * `I2C_SDA` -> ESP32-S3 `GPIO1`
  * `I2C_SCL` -> ESP32-S3 `GPIO2`
* **Temperature Sensor (Sheet 6):**
  * `TEMP_SENSE` -> ESP32-S3 `GPIO7` (ADC1_CH6)
* **Buttons (Sheet 7):**
  * Up: `GPIO15`, Down: `GPIO16`, Left: `GPIO17`, Right: `GPIO18`, OK: `GPIO8` (All active-low with 10k pull-ups and 100nF caps).
