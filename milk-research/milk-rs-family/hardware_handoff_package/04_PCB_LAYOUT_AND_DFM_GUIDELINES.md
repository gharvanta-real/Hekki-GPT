# 📐 04 - PCB Layout, Trace Widths & DFM Guidelines

This document outlines the physical rules, board stackup, trace specifications, and Design for Manufacturing (DFM) guidelines for the PCB Layout Designer.

---

## 📏 1. Mechanical Board Outline & Constraints

* **Board Dimensions:** $100.0\text{ mm}$ Height $\times 60.0\text{ mm}$ Width (Rectangular format).
* **Corner Radius:** $3.0\text{ mm}$ smooth rounded corners.
* **Mounting Holes:** 4x M3 grounded plated mounting holes located at:
  * `H1`: $(5.0\text{ mm}, 5.0\text{ mm})$
  * `H2`: $(55.0\text{ mm}, 5.0\text{ mm})$
  * `H3`: $(5.0\text{ mm}, 95.0\text{ mm})$
  * `H4`: $(55.0\text{ mm}, 95.0\text{ mm})$
  * *Hole Diameter:* $3.2\text{ mm}$ drill with $6.0\text{ mm}$ copper pad via pattern connected to main `GND`.
* **Fiducials:** 3x optical Pick-and-Place fiducials ($1.0\text{ mm}$ mark, $2.0\text{ mm}$ mask opening) placed at:
  * `FID1`: $(5.0\text{ mm}, 50.0\text{ mm})$
  * `FID2`: $(55.0\text{ mm}, 30.0\text{ mm})$
  * `FID3`: $(30.0\text{ mm}, 95.0\text{ mm})$

---

## 🥞 2. Recommended Layer Stackup (4-Layer FR4)

```
Top Layer (Layer 1): Signal Traces + Component SMD Pads (1 oz Copper)
-------------------------------------------------------------------------
Prepreg: FR-4 Core (0.21mm)
-------------------------------------------------------------------------
Inner Layer 1 (Layer 2): Solid GND Return Plane (1 oz Copper - Continuous)
-------------------------------------------------------------------------
Core: FR-4 Core (1.00mm)
-------------------------------------------------------------------------
Inner Layer 2 (Layer 3): +3.3V Power Plane & Secondary Routing (1 oz Copper)
-------------------------------------------------------------------------
Prepreg: FR-4 Core (0.21mm)
-------------------------------------------------------------------------
Bottom Layer (Layer 4): Ground Pour + Non-Critical Signals (1 oz Copper)
```

* **Total Board Thickness:** $1.6\text{ mm} \pm 10\%$
* **Solder Mask:** Matte Black or Green.
* **Silkscreen:** White high-contrast component labels.

---

## ⚡ 3. Trace Width & Spacing Rules

| Net Class | Recommended Width | Minimum Clearance | Max Current | Layer |
| :--- | :--- | :--- | :--- | :--- |
| **`VBUS` (5V Input)** | $0.60\text{ mm}$ (24 mils) | $0.25\text{ mm}$ | $1.2\text{ A}$ | Top / Bottom |
| **`VBAT_SYS` (LiPo Rail)**| $0.50\text{ mm}$ (20 mils) | $0.25\text{ mm}$ | $1.0\text{ A}$ | Top / Bottom |
| **`+3.3V` Main Supply**| $0.50\text{ mm}$ (20 mils) | $0.25\text{ mm}$ | $0.8\text{ A}$ | Layer 3 Power Plane / Top |
| **USB D+ / D- Pair** | $0.20\text{ mm}$ (8 mils) | $0.15\text{ mm}$ | $50\text{ mA}$ | Top ($90\ \Omega$ Differential Pair) |
| **Analog Signals (TIA)** | $0.25\text{ mm}$ (10 mils) | $0.30\text{ mm}$ | Low noise | Top (Guard Ring Ground Shield) |
| **Digital / SPI / I2C** | $0.20\text{ mm}$ (8 mils) | $0.20\text{ mm}$ | Low noise | Top / Layer 3 / Bottom |

---

## 🛡️ 4. Critical Layout & EMI Guidelines

1. **ESP32-S3 Antenna Zone:**
   * Place the ESP32-S3 module at the top center $(30\text{ mm}, 20\text{ mm})$.
   * **Keep-Out:** NO copper, NO traces, and NO inner ground planes under the PCB 3D meandered antenna area ($15\text{ mm} \times 7\text{ mm}$ clearance cutout on all 4 layers).
2. **Analog Sensor Isolation:**
   * Keep the **Optical TIA circuit** (left-middle $(12\text{ mm}, 35\text{ mm})$) and **AD5933 EC circuit** (right-middle $(48\text{ mm}, 35\text{ mm})$) separated by at least **$20\text{ mm}$** from switching power regulators, buzzer driver, and Wi-Fi antenna.
   * Keep Photodiode trace length to TLV9062 input **below $5\text{ mm}$**.
3. **Decoupling Capacitors:**
   * Place $100\text{nF}$ ceramic bypass capacitors within **$2\text{ mm}$** of IC power pins (ESP32 VDD, AD5933 VDD, TLV9062 VCC).
4. **Thermal Reliefs:**
   * Connect all ground component pads to ground planes using standard 4-spoke thermal reliefs ($0.25\text{ mm}$ spoke width) for easy soldering.
