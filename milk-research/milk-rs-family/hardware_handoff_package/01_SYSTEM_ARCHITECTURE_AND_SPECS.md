# ⚡ 01 - System Architecture & Subsystem Specifications

This document details the functional blocks, voltage levels, signal pathways, and design specifications for the RIOHS B4 Milk Analyzer motherboard.

---

## 🏗️ 1. Block Diagram

```
+-----------------------------------------------------------------------------------+
|                                 POWER SYSTEM                                      |
| USB-C (5V) ---> TP4056 Charger ---> DW01A Protection ---> AP2112K LDO (3.3V Output) |
+----------------------------------------+------------------------------------------+
                                         | 3.3V Power Rail
                                         v
+-----------------------------------------------------------------------------------+
|                            ESP32-S3 MICROCONTROLLER                               |
|                     (ESP32-S3-WROOM-1-N8R2 Module - 8MB/2MB)                       |
+--------+-------------------+--------------------+-------------------+-------------+
         |                   |                    |                   |
         v                   v                    v                   v
+------------------+ +------------------+ +-----------------+ +------------------+
| OPTICAL FRONT-END| | IMPEDANCE / EC   | | TEMPERATURE     | | USER INTERFACE   |
| 940nm NIR LED    | | AD5933 Analyzer  | | 10k NTC Probe   | | 1.8" SPI TFT LCD |
| Pulse MOSFET     | | TLV9062 Buffer   | | Filter Cap      | | 5x D-Pad Buttons |
| Dual PIN Diodes  | | DC-Block Cap     | | ADC Divider     | | Active Buzzer    |
| TLV9062 TIA      | | I2C (GPIO1/2)    | | (GPIO7)         | | PWM Backlight    |
| (GPIO5/6/12)     | +------------------+ +-----------------+ +------------------+
+------------------+
```

---

## 🔬 2. Subsystem Specifications

### Subsystem 1: Power Management
* **Input:** USB Type-C (5V VBUS) with ESD protection (`USBLC6-2SC6`) and a 500mA resettable polyfuse (`F1`).
* **Battery Charger:** TP4056 linear charger IC. Charging current set to **500mA** ($R_{\text{prog}} = 2.4\text{k}\Omega$) for low thermal dissipation inside the casing.
* **Battery Protection:** DW01A battery protection IC paired with FS8205A dual N-channel MOSFET. Prevents cell overcharge ($>4.25\text{V}$), over-discharge ($<2.9\text{V}$), and short-circuit.
* **LDO Regulator:** AP2112K-3.3 ultra-low dropout regulator. Provides low-noise, stable **3.3V @ 600mA** supply to MCU, ADCs, and analog op-amps.
* **Battery Monitor:** $100\text{k}\Omega / 100\text{k}\Omega$ 1% resistor divider with a $100\text{nF}$ filter cap mapping $0\text{--}4.2\text{V}$ battery output to $0\text{--}2.1\text{V}$ for ESP32 ADC sampling.

### Subsystem 2: Microcontroller Core (ESP32-S3)
* **Module:** Espressif `ESP32-S3-WROOM-1-N8R2`. Dual-core Xtensa LX7 @ 240MHz, 8MB Quad SPI Flash, 2MB Pseudo-static RAM (PSRAM).
* **Reset Circuit:** $10\text{k}\Omega$ pull-up resistor and $10\mu\text{F}$ capacitor on EN pin for reliable power-on RC reset.
* **Buttons:** Manual EN (Reset) and IO0 (Bootloader) tactile switches for debugging.

### Subsystem 3: USB/UART Interface
* **Serial Converter:** CH340C USB-to-UART IC (SOP-16) with built-in internal crystal oscillator.
* **Auto-Reset Circuit:** Pair of S8050 NPN transistors (`Q2`, `Q3`) cross-coupled to DTR/RTS lines for automatic firmware flashing from ESP-IDF / Arduino IDE.

### Subsystem 4: Optical Front-End (NIR Transreflectance)
* **Emitter:** Vishay `VSLB9530S` 940nm Infrared LED / VCSEL driven by a `2N7002` N-Channel MOSFET low-side switch. Controlled via ESP32 `GPIO12` (`OPT_TRIGGER`). Pulsed emission mode ($1\text{ms}$ ON pulses) eliminates ambient light contamination.
* **Sensors:** Two `PD204-6C` PIN photodiodes:
  * **Main Photodiode (`D6`):** Captures milk transreflectance light.
  * **Reference Photodiode (`D5`):** Placed adjacent to NIR LED to normalize LED aging and thermal drift.
* **Amplification:** TI `TLV9062IDR` dual Rail-to-Rail precision op-amp configured as zero-bias Transimpedance Amplifiers (TIA) with $100\text{k}\Omega$ feedback resistors and $22\text{pF}$ stability caps.

  > **Design Freeze Note:** Early research docs (components_spec.md) mention OPA350UA. That was a Phase-1 draft. **TLV9062IDR is the final locked component** for both Optical TIA (U7) and EC Buffer (U9). Do NOT use OPA350.
* **Output Filtering:** $1\text{k}\Omega$ resistor + $10\text{nF}$ cap low-pass RC filters ($15.9\text{kHz}$ cutoff) feeding ESP32 `GPIO5` and `GPIO6` ADCs.

### Subsystem 5: Electrical Conductivity (EC / Impedance)
* **Analyzer IC:** Analog Devices `AD5933` 12-bit 1MSPS Impedance Converter. Communicates via I2C (`GPIO1` = SDA, `GPIO2` = SCL). Operates using its internal 16.776MHz clock.
* **Excitation Buffer:** TLV9062 op-amp configured as a unity-gain buffer driving the probe electrodes.
* **DC-Blocking Capacitor:** $10\mu\text{F}$ capacitor in series with the excitation probe ensures **zero DC bias** across milk electrodes, preventing electrolysis and electrode polarization degradation.
* **Calibration Resistor:** On-board $10\text{k}\Omega$ 0.1% resistor (`R21`) for software gain calibration.

### Subsystem 6: Temperature Sensing
* **Probe:** $10\text{k}\Omega$ NTC Thermistor ($B = 3950\text{K}$) integrated inside the sensing tip.
* **Divider:** $10\text{k}\Omega$ 1% pull-up resistor to 3.3V and $100\text{nF}$ filter cap connected to ESP32 `GPIO7` (ADC1_CH6).

### Subsystem 7: User Interface & Alerts
* **Display:** 1.8" Color SPI TFT LCD (ST7735S, $128\times160$ resolution). Interface: SPI (SCK, MOSI, CS, DC, RST) + PWM Backlight brightness control (`GPIO21`).
* **Navigation D-Pad:** 5 tactile switches (Up, Down, Left, Right, OK). All active-low inputs with $10\text{k}\Omega$ pull-up resistors and $100\text{nF}$ debouncing capacitors.
* **Audio Alert:** Active magnetic piezo buzzer driven via `2N7002` MOSFET on `GPIO26` with a `BAT54` flyback Schottky diode.
