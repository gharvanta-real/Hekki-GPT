# ✅ 08 - Hardware Build & Test Checklist (0% to 100%)

Use this checklist to track every step from bare PCB to fully working device. Tick each box as you complete it.

---

## PHASE 1 — Component Procurement ✅

- [ ] Order all ICs from LCSC using LCSC part numbers in `02_BOM_AND_COMPONENTS_LIST.md`
- [ ] Order 0603 SMD resistors and capacitors (full list in `02_BOM`)
- [ ] Order JST PH 2.0mm connectors (J2, J3, J4, J6)
- [ ] Order USB-C receptacle TYPE-C-31-M-12 (J1)
- [ ] Order 1.8" SPI TFT LCD module (ST7735S, 8-pin header)
- [ ] Order 7x TS-1187A tactile buttons (SW2–SW8)
- [ ] Order SPDT PCM12 slide switch (SW1)
- [ ] Order 3.7V LiPo Battery (600–1200mAh, JST PH 2.0mm)
- [ ] Order 316L stainless steel pins (2mm diameter, for EC electrodes)
- [ ] Order 5mm optical sapphire glass window

---

## PHASE 2 — PCB Design & Fabrication ✅

- [ ] Create schematic in KiCad or EasyEDA using `03_PIN_MAPPING_AND_SCHEMATIC_WIRING.md`
- [ ] Verify all nets: VBUS → F1 → U1 → U2/U3 → SW1 → U4 → 3.3V
- [ ] Verify ESP32 GPIO connections against `03_PIN_MAPPING` table
- [ ] Check USB D+/D- differential pair (90Ω impedance, matched length)
- [ ] Place 100nF decoupling caps within 2mm of every IC VCC pin
- [ ] ESP32 antenna keep-out zone clear (15mm × 7mm, no copper on any layer)
- [ ] Optical TIA traces (Photodiode to TLV9062) < 5mm
- [ ] Run ERC (Electrical Rules Check) — 0 errors
- [ ] Run DRC (Design Rules Check) — 0 errors
- [ ] Export Gerber files + Excellon drill files
- [ ] Upload to JLCPCB / local PCB vendor, select 4-layer FR4, 1.6mm, black solder mask
- [ ] Receive bare PCBs

---

## PHASE 3 — SMT Assembly ✅

- [ ] Inspect bare PCB for delamination or drill burrs
- [ ] Apply solder paste using stencil (or hand-solder for prototype)
- [ ] Place SMD components per designators (U1–U9, Q1–Q6, D1–D9, R1–R38, C1–C31)
- [ ] Reflow solder (peak 245°C for SAC305 lead-free solder paste)
- [ ] Inspect all solder joints under magnification
- [ ] Hand solder through-hole connectors: J1 (USB-C), J2–J9 (JST headers), SW1–SW8

---

## PHASE 4 — First Power-On Test ✅

- [ ] **DO NOT connect battery yet.**
- [ ] Connect USB-C to bench power supply, set limit to 5V / 200mA
- [ ] Measure 3.3V at AP2112K output pin (U4 Pin 5) — should read 3.28V–3.32V
- [ ] Measure 3.3V at ESP32-S3 VDD pin — same reading
- [ ] Verify no short circuits (current draw at idle should be < 80mA with USB only)
- [ ] **Now connect battery** and test slide switch SW1 (On/Off)

---

## PHASE 5 — Firmware Flash & Boot ✅

- [ ] Install Arduino IDE + ESP32 board package (see `07_FIRMWARE_FLASH_AND_BOOT_GUIDE.md`)
- [ ] Install CH340C driver (Windows only)
- [ ] Connect USB-C to PC
- [ ] Open `firmware_test_harness.ino` in Arduino IDE
- [ ] Set board to `ESP32S3 Dev Module`, Flash=8MB, PSRAM=OPI
- [ ] Click Upload → wait for "Hard resetting via RTS pin"
- [ ] Open Serial Monitor at 115200 baud
- [ ] Confirm output: `RIOHS B4 Milk Analyzer — Boot OK`

---

## PHASE 6 — Sensor Verification ✅

- [ ] **AD5933 EC Sensor:** Serial Monitor shows `AD5933 Init: OK`
- [ ] **NTC Temperature:** Serial shows `NTC Temp: 25.x C` (at room temperature)
- [ ] **Optical Sensor:** With IR LED pulsing, `OPT_MAIN ADC` and `OPT_REF ADC` both show non-zero values
- [ ] **TFT Display:** Screen shows RIOHS logo / boot menu on power-on
- [ ] **D-Pad Buttons:** All 5 buttons (Up, Down, Left, Right, OK) register in serial output
- [ ] **Buzzer:** Short beep plays on startup

---

## PHASE 7 — Probe Assembly & Final Integration ✅

- [ ] Mount sapphire window in ABS probe tip housing with food-safe epoxy
- [ ] Insert stainless steel EC electrode pins (12mm apart)
- [ ] Seat NTC thermistor in thermal pocket with TC-2810 epoxy
- [ ] Connect EC probe harness to J3 (Red=EC_EXCITE, Black=EC_RECEIVE)
- [ ] Connect NTC harness to J4 (Yellow=TEMP_SENSE, Black=GND)
- [ ] Perform air-pressure leak test at 5 PSI (IP54 check)
- [ ] Run full milk sample test — device shows Purity Index on screen

---

## ✅ Build Complete!
