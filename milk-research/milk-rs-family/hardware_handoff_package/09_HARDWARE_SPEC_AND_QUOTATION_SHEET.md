# 📋 RIOHS B4 Milk Analyzer — Hardware Specification & Procurement Sheet

**Project:** RIOHS B4 Milk Quality Analyzer — Prototype V1  
**Document Type:** Hardware Procurement Specification / Quotation Sheet  
**Version:** 1.0  
**Date:** _______________  
**Prepared By:** _______________  
**Vendor / Supplier:** _______________

---

## 🔲 SECTION A — Integrated Circuits (ICs)

| # | Reference | Component Name | Manufacturer & Model | Package | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|:--|:--|
| 1 | U5 | Microcontroller Module | Espressif `ESP32-S3-WROOM-1-N8R2` (8MB Flash, 2MB PSRAM) | SMD Module | 1 | | |
| 2 | U1 | LiPo Battery Charger IC | `TP4056` (500mA charge rate) | SOP-8 | 1 | | |
| 3 | U2 | Battery Protection IC | `DW01A` (Overcharge / Over-discharge) | SOT-23-6 | 1 | | |
| 4 | U3 | Protection MOSFET Switch | `FS8205A` (Dual N-Channel) | SOT-23-6 | 1 | | |
| 5 | U4 | 3.3V LDO Voltage Regulator | `AP2112K-3.3` (600mA, Ultra-Low Dropout) | SOT-23-5 | 1 | | |
| 6 | U6 | USB-to-UART Bridge IC | `CH340C` (Internal Crystal, No Ext. Xtal) | SOP-16 | 1 | | |
| 7 | U7 | Dual Precision Op-Amp (Optical TIA) | TI `TLV9062IDR` (Rail-to-Rail, 10MHz) | SOIC-8 | 1 | | |
| 8 | U8 | Impedance / EC Analyzer IC | Analog Devices `AD5933WYDKZ` (12-bit, 1MSPS) | SSOP-16 | 1 | | |
| 9 | U9 | Dual Precision Op-Amp (EC Buffer) | TI `TLV9062IDR` (same as U7) | SOIC-8 | 1 | | |
| | | | | | **SUBTOTAL A** | | |

---

## 🔲 SECTION B — Transistors & MOSFETs

| # | Reference | Component Name | Model | Package | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|:--|:--|
| 10 | Q1 | Reverse Polarity Protection P-MOSFET | `AO3401` (P-Channel, 30V, 4A) | SOT-23 | 1 | | |
| 11 | Q2 | Auto-Reset NPN Transistor (DTR line) | `S8050` (NPN, 40V, 500mA) | SOT-23 | 1 | | |
| 12 | Q3 | Auto-Reset NPN Transistor (RTS line) | `S8050` (NPN, 40V, 500mA) | SOT-23 | 1 | | |
| 13 | Q4 | IR LED Driver N-MOSFET | `2N7002` (N-Channel, 60V, 300mA) | SOT-23 | 1 | | |
| 14 | Q5 | TFT Backlight Driver N-MOSFET | `2N7002` (N-Channel, 60V, 300mA) | SOT-23 | 1 | | |
| 15 | Q6 | Piezo Buzzer Driver N-MOSFET | `2N7002` (N-Channel, 60V, 300mA) | SOT-23 | 1 | | |
| | | | | | **SUBTOTAL B** | | |

---

## 🔲 SECTION C — Diodes

| # | Reference | Component Name | Model | Package | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|:--|:--|
| 16 | D1 | Power Isolation Schottky Diode | `SS14` / `1N5819` (40V, 1A) | SMA | 1 | | |
| 17 | D2 | Battery Discharge Schottky Diode | `SS14` / `1N5819` (40V, 1A) | SMA | 1 | | |
| 18 | D3 | VBUS Clamp Schottky Diode | `SS14` / `1N5819` (40V, 1A) | SMA | 1 | | |
| 19 | D4 | 940nm NIR Infrared LED Emitter | Vishay `VSLB9530S` (940nm, 1.3Vf) | 0603 SMD | 1 | | |
| 20 | D5 | Reference Silicon PIN Photodiode | Everlight `PD204-6C` (940nm sensitive) | 0603 SMD | 1 | | |
| 21 | D6 | Main Silicon PIN Photodiode | Everlight `PD204-6C` (940nm sensitive) | 0603 SMD | 1 | | |
| 22 | D7 | Buzzer Flyback Clamp Schottky | `BAT54` (30V, 200mA) | SOT-23 | 1 | | |
| 23 | D8 | ESD Protection Array (Debug Header) | `SRV05-4` (5V clamp, 4-line) | SOT-23-6 | 1 | | |
| 24 | D9 | ESD Protection Array (SPI Header) | `SRV05-4` (5V clamp, 4-line) | SOT-23-6 | 1 | | |
| | | | | | **SUBTOTAL C** | | |

---

## 🔲 SECTION D — Passive Components (Resistors)

> All resistors: **0603 SMD package** (1.6mm × 0.8mm), unless noted.

| # | Reference | Value | Tolerance | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|:--|
| 25 | R1 | 2.4 kΩ | 1% | 1 | | |
| 26 | R3, R4 | 100 kΩ | 1% | 2 | | |
| 27 | R5, R6 | 100 kΩ | 1% | 2 | | |
| 28 | R9, R10 | 10 kΩ | 1% | 2 | | |
| 29 | R11 | 10 kΩ | 1% | 1 | | |
| 30 | R15 | 100 Ω | 1% | 1 | | |
| 31 | R16, R17 | 100 kΩ | 1% | 2 | | |
| 32 | R18, R19 | 1 kΩ | 1% | 2 | | |
| 33 | R21 | 10 kΩ | **0.1% Precision** | 1 | | |
| 34 | R22 | 1 kΩ | 1% | 1 | | |
| 35 | R23, R24 | 4.7 kΩ | 1% | 2 | | |
| 36 | R25 | 10 kΩ | 1% | 1 | | |
| 37 | R26 | 10 kΩ | 1% | 1 | | |
| 38 | R27 | 39 Ω | 1% | 1 | | |
| 39 | R28, R29, R30, R31, R32 | 10 kΩ | 1% | 5 | | |
| 40 | R33 | 100 Ω | 1% | 1 | | |
| 41 | R34 | 100 kΩ | 1% | 1 | | |
| 42 | R35, R36, R37, R38 | 100 Ω | 1% | 4 | | |
| | | | **SUBTOTAL D** | **Total Resistors: ~35 pcs** | | |

---

## 🔲 SECTION E — Passive Components (Capacitors)

> All capacitors: **0603 SMD package**, unless noted.

| # | Reference | Value | Voltage | Type | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|:--|:--|
| 43 | C13, C14 | 22 pF | 50V | C0G / NP0 | 2 | | |
| 44 | C15, C16 | 10 nF | 50V | X7R | 2 | | |
| 45 | C2, C4, C5, C7, C8, C10, C12 | 100 nF | 50V | X7R | 7 | | |
| 46 | C17, C20, C21, C22, C24 | 100 nF | 50V | X7R | 5 | | |
| 47 | C25, C26, C27, C28, C29, C30 | 100 nF | 50V | X7R | 6 | | |
| 48 | C1, C3, C6, C9, C11 | 10 µF | 10V | X5R / X7R | 5 | | |
| 49 | C18, C19, C23, C31 | 10 µF | 10V | X5R / X7R | 4 | | |
| 50 | C8 (EN reset cap) | 10 µF | 10V | X5R / X7R | 1 | | |
| | | | | **SUBTOTAL E** | **Total Caps: ~32 pcs** | | |

---

## 🔲 SECTION F — Connectors & Switches

| # | Reference | Component Name | Specification | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|:--|
| 51 | J1 | USB Type-C Receptacle | TYPE-C-31-M-12, 16-pin Mid-mount, SMD | 1 | | |
| 52 | J2 | Battery JST PH 2.0mm Connector | 2-Pin Right-Angle Female Header | 1 | | |
| 53 | J3 | EC Probe JST PH 2.0mm Connector | 2-Pin Right-Angle Female Header | 1 | | |
| 54 | J4 | NTC Temp Probe JST PH 2.0mm Connector | 2-Pin Right-Angle Female Header | 1 | | |
| 55 | J5 | TFT Display 1×08 Pin Header (Female) | 2.54mm pitch, 8-pin, Vertical | 1 | | |
| 56 | J6 | Buzzer JST PH 2.0mm Connector | 2-Pin Right-Angle Female Header | 1 | | |
| 57 | J7 | I2C Debug Header (Male) | 2.54mm pitch, 4-pin, Vertical | 1 | | |
| 58 | J8 | UART Debug Header (Male) | 2.54mm pitch, 5-pin, Vertical | 1 | | |
| 59 | J9 | SPI Breakout Header (Male) | 2.54mm pitch, 6-pin, Vertical | 1 | | |
| 60 | SW1 | Main Power Slide Switch | SPDT PCM12, SMD | 1 | | |
| 61 | SW2 | EN Reset Tactile Button | TS-1187A, 4.5×4.5mm SMD | 1 | | |
| 62 | SW3 | Boot / IO0 Tactile Button | TS-1187A, 4.5×4.5mm SMD | 1 | | |
| 63 | SW4 | D-Pad UP Navigation Button | TS-1187A, 4.5×4.5mm SMD | 1 | | |
| 64 | SW5 | D-Pad DOWN Navigation Button | TS-1187A, 4.5×4.5mm SMD | 1 | | |
| 65 | SW6 | D-Pad LEFT Navigation Button | TS-1187A, 4.5×4.5mm SMD | 1 | | |
| 66 | SW7 | D-Pad RIGHT Navigation Button | TS-1187A, 4.5×4.5mm SMD | 1 | | |
| 67 | SW8 | D-Pad OK (Center) Navigation Button | TS-1187A, 4.5×4.5mm SMD | 1 | | |
| | | | | | **SUBTOTAL F** | | |

---

## 🔲 SECTION G — Protection & Fusing

| # | Reference | Component Name | Specification | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|:--|
| 68 | F1 | Resettable Polyfuse | 500mA hold, 1812 SMD package | 1 | | |
| | | | | | **SUBTOTAL G** | | |

---

## 🔲 SECTION H — Display & Audio

| # | Reference | Component Name | Specification | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|:--|
| 69 | LCD1 | 1.8" SPI Color TFT Display Module | ST7735S, 128×160 px, 8-pin 2.54mm header | 1 | | |
| 70 | BZ1 | Active Magnetic Piezo Buzzer | 3.3V / 5V, Through-hole or SMD, JST 2-pin | 1 | | |
| | | | | | **SUBTOTAL H** | | |

---

## 🔲 SECTION I — Power Source

| # | Reference | Component Name | Specification | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|:--|
| 71 | BAT1 | Lithium Polymer (LiPo) Battery | 3.7V, 1200mAh, JST PH 2.0mm connector | 1 | | |
| | | | | | **SUBTOTAL I** | | |

---

## 🔲 SECTION J — PCB Fabrication

| # | Item | Specification | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|
| 72 | Custom PCB | 4-Layer FR4, 100mm × 60mm, 1.6mm thick, Black solder mask, ENIG finish | 1 set (5 pcs min) | | |
| | | | | **SUBTOTAL J** | |

---

## 🔲 SECTION K — Mechanical & Sensor Probe Parts

| # | Item | Specification | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|
| 73 | Optical Sapphire Window | Ø5mm × 1mm, Optical-grade polish (Ra < 0.8µm) | 1 | | |
| 74 | EC Stainless Steel Electrode Pin | Ø2mm × 20mm, 316L Food-grade stainless steel | 2 | | |
| 75 | NTC Thermistor Probe (10k) | Murata NXFT15XH103FA2B0, 10kΩ ±1%, B=3950K | 1 | | |
| 76 | ABS Probe Tip Housing | Custom molded black ABS enclosure (30mm × 15mm) | 1 | | |
| 77 | EPDM O-Ring Seal | Shore A 70, food-grade, Ø10mm × 2mm cross-section | 2 | | |
| 78 | Food-Safe Epoxy (Optical Seal) | Master Bond EP42HT-2FG or equivalent | 1 (small tube) | | |
| 79 | Thermal Epoxy (NTC Capsule) | 3M TC-2810 or equivalent | 1 (small tube) | | |
| 80 | M3 Stainless Screws | M3 × 6mm, Pan Head Phillips, Stainless | 4 | | |
| 81 | M3 Brass Threaded Inserts | M3 × 4mm L, Heat-set, for ABS housing | 4 | | |
| 82 | Probe Wiring Harness | 6-conductor shielded cable, 150mm length | 1 | | |
| | | | | **SUBTOTAL K** | |

---

## 🔲 SECTION L — Assembly & Labour (Optional, Fill if Applicable)

| # | Service | Description | Qty | Unit Price | Total Price |
|:--|:--|:--|:--|:--|:--|
| 83 | SMT Assembly | SMD component placement & reflow soldering | 1 board | | |
| 84 | Through-Hole Soldering | Connectors, headers, switches | 1 board | | |
| 85 | Firmware Flashing | ESP32-S3 firmware upload & verification | 1 unit | | |
| 86 | Probe Assembly & Sealing | Optical window, electrode, NTC integration + IP54 test | 1 unit | | |
| 87 | Functional Testing | Full sensor verification (EC, Optical, Temp, Display) | 1 unit | | |
| | | | | **SUBTOTAL L** | |

---

## 💰 PRICE SUMMARY

| Section | Description | Subtotal |
|:--|:--|:--|
| **A** | Integrated Circuits (9 ICs) | |
| **B** | Transistors & MOSFETs (6 pcs) | |
| **C** | Diodes (9 pcs) | |
| **D** | Resistors (~35 pcs) | |
| **E** | Capacitors (~32 pcs) | |
| **F** | Connectors & Switches (17 pcs) | |
| **G** | Protection & Fusing (1 pc) | |
| **H** | Display & Audio (2 pcs) | |
| **I** | Power Source — LiPo Battery (1 pc) | |
| **J** | PCB Fabrication | |
| **K** | Mechanical & Probe Parts (10 items) | |
| **L** | Assembly & Labour (Optional) | |
| | **GRAND TOTAL** | **________________** |
| | GST / Tax (if applicable) | |
| | **FINAL AMOUNT** | **________________** |

---

## 📝 Terms & Notes

* Prices to be filled by vendor/supplier.
* All SMD component prices are per-unit at quoted batch quantity.
* PCB price is per-set (minimum 5 boards standard for JLCPCB).
* Delivery timeline: _______________ days from Purchase Order.
* Payment terms: _______________.

---

*Document prepared for RIOHS B4 Milk Analyzer Prototype V1 — Confidential*
