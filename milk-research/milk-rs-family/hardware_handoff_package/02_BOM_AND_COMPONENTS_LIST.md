# 🛒 02 - Bill of Materials & Component Procurement Guide

This document contains the complete **Bill of Materials (BOM)** required to purchase parts for 100% assembly. All parts have verified **LCSC Part Numbers** for easy ordering from JLCPCB / LCSC / Mouser / Local vendors.

---

## 📦 Master Component List

| Item | Designators | Description | Package / Footprint | LCSC Part # | Qty | Function |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | U5 | ESP32-S3-WROOM-1-N8R2 | Module (SMD) | `C2913202` | 1 | Microcontroller Core |
| **2** | U1 | TP4056 Battery Charger IC | SOP-8-PP | `C159074` | 1 | 500mA LiPo Charger |
| **3** | U2 | DW01A Battery Protection IC | SOT-23-6 | `C14207` | 1 | Cell Protection |
| **4** | U3 | FS8205A Dual N-Channel MOSFET | SOT-23-6 | `C16052` | 1 | Protection Switch |
| **5** | U4 | AP2112K-3.3 LDO Voltage Regulator | SOT-23-5 | `C51118` | 1 | 3.3V Power Supply |
| **6** | U6 | CH340C USB-to-UART Bridge | SOP-16 | `C84681` | 1 | Serial Flashing Bridge |
| **7** | U7, U9 | TLV9062IDR Dual Precision Op-Amp | SOIC-8 | `C109503` | 2 | Optical TIA & EC Buffer |
| **8** | U8 | AD5933WYDKZ 1MSPS Impedance Analyzer | SSOP-16 | `C16790` | 1 | Conductivity Sensor IC |
| **9** | Q1 | AO3401 P-Channel MOSFET | SOT-23 | `C12217` | 1 | Reverse Polarity Protection |
| **10** | Q2, Q3 | S8050 NPN Transistor | SOT-23 | `C2146` | 2 | Auto-Reset Logic |
| **11** | Q4, Q5, Q6| 2N7002 N-Channel MOSFET | SOT-23 | `C20917` | 3 | LED, Backlight & Buzzer Driver |
| **12** | D1, D2, D3| 1N5819 / SS14 Schottky Diode | SMA | `C8598` | 3 | Power Isolation Diodes |
| **13** | D4 | VSLB9530S 940nm IR LED Emitter | SMD 0603 | `C108252` | 1 | Optical Light Source |
| **14** | D5, D6 | PD204-6C PIN Photodiode | 3mm / 0603 SMD | `C20600` | 2 | Light Sensors (Ref & Main) |
| **15** | D7 | BAT54 Flyback Schottky Diode | SOT-23 | `C8164` | 1 | Buzzer Inductive Clamp |
| **16** | D8, D9 | SRV05-4 ESD Protection Diode Array | SOT-23-6 | `C85273` | 2 | Debug Header Protection |
| **17** | F1 | 500mA Resettable Polyfuse (1812) | 1812 SMD | `C20694` | 1 | USB VBUS Current Fuse |
| **18** | J1 | TYPE-C-31-M-12 USB-C Receptacle | 16-Pin Mid-mount | `C165948` | 1 | Power & Flashing Port |
| **19** | J2, J3, J4, J6 | JST PH 2.0mm 2-Pin Angle Connector | 2-Pin Male Header | `C157929` | 4 | Battery, EC, Temp & Buzzer Ports |
| **20** | J5 | 1x08 2.54mm Pin Header (Female) | 1x08 Vertical | `C124379` | 1 | 1.8" TFT Screen Port |
| **21** | J7 | 1x04 2.54mm Pin Header (Male) | 1x04 Vertical | `C124375` | 1 | I2C Breakout Header |
| **22** | J8 | 1x05 2.54mm Pin Header (Male) | 1x05 Vertical | `C124376` | 1 | UART Debug Header |
| **23** | J9 | 1x06 2.54mm Pin Header (Male) | 1x06 Vertical | `C124377` | 1 | SPI Breakout Header |
| **24** | SW1 | SPDT PCM12 Slide Power Switch | SMD | `C139785` | 1 | Main On/Off Switch |
| **25** | SW2-SW8 | TS-1187A Tactile Push Buttons | SMD 4.5x4.5mm | `C318597` | 7 | EN, BOOT & 5 Navigation Keys |
| **26** | Passives | 0603 SMD Resistors & Capacitors | 0603 (1608 Metric)| Various | Multi | Standard Passives (See Net Specs) |

---

## 🛠️ Resistors & Capacitors Breakdown (0603 Package)

* **Resistors:**
  * $39\ \Omega$ 1%: `R27` (Backlight current limit)
  * $100\ \Omega$ 1%: `R15`, `R33`, `R35-R38` (LED limit, Buzzer gate, Debug protection)
  * $1\text{k}\Omega$ 1%: `R18`, `R19`, `R22` (Low-pass filters & EC excitation limit)
  * $2.4\text{k}\Omega$ 1%: `R1` (TP4056 charge current set)
  * $4.7\text{k}\Omega$ 1%: `R23`, `R24` (I2C SDA/SCL pull-ups)
  * $10\text{k}\Omega$ 1%: `R3`, `R4`, `R9`, `R10`, `R11`, `R25`, `R26`, `R28-R32` (Pull-ups & Debounce)
  * $10\text{k}\Omega$ 0.1% Precision: `R21` (AD5933 Calibration resistor)
  * $100\text{k}\Omega$ 1%: `R5`, `R6`, `R16`, `R17`, `R34` (Voltage divider & TIA feedback)

* **Capacitors:**
  * $22\text{pF}$ C0G/NP0: `C13`, `C14` (TIA feedback stability)
  * $10\text{nF}$ 50V X7R: `C15`, `C16` (Optical low-pass filter)
  * $100\text{nF}$ 50V X7R: `C2`, `C4`, `C5`, `C7`, `C8`, `C10`, `C12`, `C17`, `C20`, `C21`, `C22`, `C24`, `C25-C30` (Bypass & Debounce)
  * $10\mu\text{F}$ 10V X5R/X7R: `C1`, `C3`, `C6`, `C9`, `C11`, `C18`, `C19`, `C23`, `C31` (Bulk power filtering & AC coupling)
