# 🔌 03 - Complete 0% to 100% Pin Mapping & Schematic Wiring Guide

This document is the **master electrical roadmap**. It lists every single net connection in the entire system, allowing a schematic designer or technician to wire the circuit from **0% to 100% with zero ambiguity**.

---

## 📌 1. ESP32-S3 Pin Allocation Table

| ESP32 Pin | GPIO Num | Net Name | Connected Component & Function |
| :--- | :--- | :--- | :--- |
| **Pin 1** | GND | `GND` | Ground Return Plane |
| **Pin 2** | 3V3 | `+3.3V` | 3.3V Power Rail Output from AP2112K LDO |
| **Pin 3** | EN | `EN` | MCU Reset Pin (Pull-up R11 = 10k, Cap C8 = 10uF, SW2 button) |
| **Pin 4** | GPIO1 | *(reserved / NC)* | Not connected in this design |
| **Pin 5** | GPIO2 | *(reserved / NC)* | Not connected in this design |
| **Pin 6** | GPIO16 | `I2C_SDA` | AD5933 SDA Data Line (4.7k Pull-up R23 + Debug Header J7) |
| **Pin 7** | GPIO17 | `I2C_SCL` | AD5933 SCL Clock Line (4.7k Pull-up R24 + Debug Header J7) |
| **Pin 6** | GPIO4 | `BAT_ADC` | Battery Voltage Monitor ADC Input ($100\text{k}/100\text{k}$ Divider Node) |
| **Pin 7** | GPIO5 | `OP_MAIN_OUT` | Main Photodiode Optical Transreflectance Signal (ADC1_CH4) |
| **Pin 8** | GPIO6 | `OP_REF_OUT` | Reference Photodiode Signal for LED Aging Compensation (ADC1_CH5) |
| **Pin 9** | GPIO7 | `TEMP_SENSE` | NTC Thermistor Voltage Divider Input (ADC1_CH6) |
| **Pin 10**| GPIO8 | `BTN_OK` | Center OK Navigation Button (Active Low, 10k Pull-up + 100nF Cap) |
| **Pin 11**| GPIO9 | `TFT_CS` | 1.8" TFT SPI Chip Select (`J5` Pin 3) |
| **Pin 12**| GPIO10 | `TFT_SCLK` | 1.8" TFT SPI Clock (`J5` Pin 7) |
| **Pin 13**| GPIO11 | `TFT_MOSI` | 1.8" TFT SPI Data (`J5` Pin 6) |
| **Pin 14**| GPIO12 | `OPT_TRIGGER`| 940nm IR LED MOSFET Gate Pulse Switch (`Q4` Gate) |
| **Pin 15**| GPIO13 | `TFT_DC` | 1.8" TFT Data/Command Control (`J5` Pin 4) |
| **Pin 16**| GPIO14 | `TFT_RST` | 1.8" TFT Hardware Reset (`J5` Pin 5) |
| **Pin 17**| GPIO15 | `BTN_UP` | D-Pad Up Button (Active Low, 10k Pull-up + 100nF Cap) |
| **Pin 18**| GPIO16 | `BTN_DOWN` | D-Pad Down Button (Active Low, 10k Pull-up + 100nF Cap) |
| **Pin 19**| GPIO17 | `BTN_LEFT` | D-Pad Left Button (Active Low, 10k Pull-up + 100nF Cap) |
| **Pin 20**| GPIO18 | `BTN_RIGHT` | D-Pad Right Button (Active Low, 10k Pull-up + 100nF Cap) |
| **Pin 21**| GPIO21 | `TFT_BL_PWM`| TFT Backlight PWM Brightness Control (`Q5` Gate) |
| **Pin 22**| GPIO26 | `BUZZER_PWM`| Audio Alert Piezo Driver Gate (`Q6` Gate) |
| **Pin 36**| GPIO43 | `TXD0` | UART0 Transmit Line (Connected to CH340C RXD Pin 3 + Header J8) |
| **Pin 37**| GPIO44 | `RXD0` | UART0 Receive Line (Connected to CH340C TXD Pin 2 + Header J8) |
| **Pin 40**| GPIO0 | `IO0` | Boot Mode Selection (SW3 Boot Button + Auto-reset Transistor Q2) |

---

## 🔗 2. Subsystem Net-by-Net Interconnection Specs

### A. Power System Net Wiring
1. **`VBUS` (5V Input):**
   * `J1` USB-C Pins A4/A9/B4/B9 -> Polyfuse `F1` (500mA) -> Diode `D1` Anode.
   * `D1` Cathode -> TP4056 `U1` Pin 4 (`VCC`) and Pin 8 (`CE`).
   * Add $10\mu\text{F}$ (`C1`) and $100\text{nF}$ (`C2`) caps from `VBUS` to `GND`.
2. **`VBAT` (LiPo Cell Unprotected):**
   * Battery Connector `J2` Pin 1 (+) -> P-MOSFET `Q1` Source.
   * `Q1` Drain -> DW01A protection switch input.
   * `J2` Pin 2 (-) -> FS8205A MOSFET Drain (`Common GND` return via protection).
3. **`VBAT_SYS` (LiPo Protected Output):**
   * TP4056 `U1` Pin 5 (`BAT`) -> SPDT Slide Switch `SW1` Pin 1.
   * `SW1` Pin 2 (Common Output) -> `VBAT_SYS` Rail.
   * `VBAT_SYS` -> AP2112K `U4` Pin 1 (`VIN`) and Pin 3 (`EN`).
   * Add $10\mu\text{F}$ (`C3`) cap from `VBAT_SYS` to `GND`.
4. **`+3.3V` (Regulated Main Rail):**
   * AP2112K `U4` Pin 5 (`VOUT`) -> `+3.3V` Rail.
   * Add $10\mu\text{F}$ (`C6`) + $100\text{nF}$ (`C7`) caps from `+3.3V` to `GND`.
   * Connect `+3.3V` to ESP32-S3 Pin 2, AD5933 `VDD`, Op-Amps `V+`, CH340C `VCC`, TFT `VCC`, and Pull-up resistors.

### B. Optical Front-End Net Wiring
1. **Emitter Drive:**
   * `OPT_TRIGGER` (`GPIO12`) -> $100\ \Omega$ Resistor `R33` -> `Q4` Gate (2N7002).
   * `Q4` Gate -> $100\text{k}\Omega$ Pull-down `R34` to `GND`.
   * `+3.3V` -> 940nm LED `D4` Anode. `D4` Cathode -> $100\ \Omega$ Limit Resistor `R15` -> `Q4` Drain. `Q4` Source -> `GND`.
2. **Transimpedance Amplifier (Main Sensor D6):**
   * Photodiode `D6` Anode -> `GND`. `D6` Cathode -> TLV9062 `U7` Pin 2 (`IN1-`).
   * TLV9062 `U7` Pin 1 (`OUT1`) -> Parallel Feedback ($100\text{k}\Omega$ `R17` \|\| $22\text{pF}$ `C14`) -> `U7` Pin 2 (`IN1-`).
   * TLV9062 `U7` Pin 3 (`IN1+`) -> `GND`.
   * `OUT1` -> $1\text{k}\Omega$ `R19` -> `OP_MAIN_OUT` -> ESP32 `GPIO5`. Add $10\text{nF}$ `C16` cap from `OP_MAIN_OUT` to `GND`.
3. **Transimpedance Amplifier (Reference Sensor D5):**
   * Photodiode `D5` Anode -> `GND`. `D5` Cathode -> TLV9062 `U7` Pin 6 (`IN2-`).
   * TLV9062 `U7` Pin 7 (`OUT2`) -> Parallel Feedback ($100\text{k}\Omega$ `R16` \|\| $22\text{pF}$ `C13`) -> `U7` Pin 6 (`IN2-`).
   * TLV9062 `U7` Pin 5 (`IN2+`) -> `GND`.
   * `OUT2` -> $1\text{k}\Omega$ `R18` -> `OP_REF_OUT` -> ESP32 `GPIO6`. Add $10\text{nF}$ `C15` cap from `OP_REF_OUT` to `GND`.

### C. Conductivity (EC / AD5933) Net Wiring
1. **I2C Bus:**
   * AD5933 `U8` Pin 15 (`SDA`) -> `I2C_SDA` -> ESP32 **`GPIO16`** (Pull-up `R23` = 4.7k to 3.3V).
   * AD5933 `U8` Pin 16 (`SCL`) -> `I2C_SCL` -> ESP32 **`GPIO17`** (Pull-up `R24` = 4.7k to 3.3V).
2. **Excitation & Measurement Paths:**
   * AD5933 `U8` Pin 6 (`VOUT`) -> TLV9062 `U9` Pin 3 (`IN1+`) (Unity gain excitation buffer).
   * `U9` Pin 1 (`OUT1`) -> `U9` Pin 2 (`IN1-`).
   * `OUT1` -> $10\mu\text{F}$ AC-blocking capacitor `C18` -> $1\text{k}\Omega$ limit resistor `R22` -> Probe Connector `J3` Pin 1 (`EC_EXCITE`).
   * Probe Connector `J3` Pin 2 (`EC_RECEIVE`) -> AD5933 `U8` Pin 5 (`VIN`).
   * Calibration Resistor `R21` ($10\text{k}\Omega$ 0.1%) connected between `U8` Pin 4 (`RFB`) and `U8` Pin 5 (`VIN`).

### D. User Interface Net Wiring
1. **TFT SPI Screen Connector (`J5` 1x08 Female Header):**
   * Pin 1 (`VCC`) -> `+3.3V` (Decoupled with $10\mu\text{F}$ `C23` + $100\text{nF}$ `C24`).
   * Pin 2 (`GND`) -> `GND`.
   * Pin 3 (`CS`)  -> `TFT_CS` (`GPIO9`).
   * Pin 4 (`DC`)  -> `TFT_DC` (`GPIO13`).
   * Pin 5 (`RST`) -> `TFT_RST` (`GPIO14`).
   * Pin 6 (`MOSI`) -> `TFT_MOSI` (`GPIO11`).
   * Pin 7 (`SCK`)  -> `TFT_SCLK` (`GPIO10`).
   * Pin 8 (`LED`)  -> `Q5` Drain (2N7002 MOSFET Backlight Switch).
2. **Backlight Switch:**
   * `TFT_BL_PWM` (`GPIO21`) -> `Q5` Gate. `Q5` Gate -> $10\text{k}\Omega$ Pull-down `R26` to `GND`. `Q5` Source -> $39\ \Omega$ Limit Resistor `R27` -> `GND`.
3. **Tactile Navigation Buttons (`SW4` to `SW8`):**
   * `SW4` (Up): Pin 1 -> `BTN_UP` (`GPIO15`), Pin 2 -> `GND`. Add $10\text{k}\Omega$ Pull-up `R28` to 3.3V + $100\text{nF}$ Cap `C25` to GND.
   * `SW5` (Down): Pin 1 -> `BTN_DOWN` (`GPIO16`), Pin 2 -> `GND`. Add $10\text{k}\Omega$ Pull-up `R29` to 3.3V + $100\text{nF}$ Cap `C26` to GND.
   * `SW6` (Left): Pin 1 -> `BTN_LEFT` (`GPIO17`), Pin 2 -> `GND`. Add $10\text{k}\Omega$ Pull-up `R30` to 3.3V + $100\text{nF}$ Cap `C27` to GND.
   * `SW7` (Right): Pin 1 -> `BTN_RIGHT` (`GPIO18`), Pin 2 -> `GND`. Add $10\text{k}\Omega$ Pull-up `R31` to 3.3V + $100\text{nF}$ Cap `C28` to GND.
   * `SW8` (OK): Pin 1 -> `BTN_OK` (`GPIO8`), Pin 2 -> `GND`. Add $10\text{k}\Omega$ Pull-up `R32` to 3.3V + $100\text{nF}$ Cap `C29` to GND.
