# 🔬 05 - Sensor Probe Tip & Physical Assembly Guide

This document explains how the physical sensing tip (Optical Sapphire Window, Dual EC Electrodes, and NTC Probe) is constructed, wired, and plugged into the main motherboard.

---

## 🛠️ 1. Probe Tip Component Integration

The bottom sensing tip of the RIOHS B4 Milk Tester houses **three distinct physical sensors** combined into a compact immersion probe:

```
+-------------------------------------------------------------------------+
|                        BOTTOM IMMERSION PROBE TIP                       |
|                                                                         |
|  [Stainless Electrode A]  [Optical Sapphire Window]  [Stainless Electrode B] |
|   (EC Probe High)          (940nm LED + 2x Photodiodes)  (EC Probe Low)    |
|                                                                         |
|                       [NTC 10k Temperature Tip]                         |
+-------------------------------------------------------------------------+
```

---

## 🔌 2. Physical Probe Connectors & Wiring Harness

The sensing tip connects to the main motherboard using standard polarized JST PH 2.0mm connectors:

| Probe Subsystem | Motherboard Header | Wire Colors | Harness Cable Type |
| :--- | :--- | :--- | :--- |
| **Electrical Conductivity (EC)** | `J3` (2-Pin JST PH) | **Red** (`EC_EXCITE`), **Black** (`EC_RECEIVE`) | Shielded Twisted Pair |
| **Temperature (NTC)** | `J4` (2-Pin JST PH) | **Yellow** (`TEMP_SENSE`), **Black** (`GND`) | 2-Conductor Ribbon Cable |
| **Optical Emitter / Detectors** | Soldered directly or 6-Pin FPC Connector | **Red** (`VCC`), **Black** (`GND`), **Blue** (`OPT_TRIG`), **Green** (`MAIN`), **White** (`REF`) | 6-Conductor Shielded Cable |

---

## 🧼 3. Assembly & Sealing Steps (IP54 Ingress Rating)

1. **Optical Sapphire Window Fitting:**
   * Fit the $5.0\text{ mm}$ circular sapphire glass window into the molded ABS lower housing pocket.
   * Seal the window perimeter using medical-grade food-safe epoxy (`Master Bond EP42HT-2FG` or equivalent) to prevent milk infiltration into the optical chamber.
2. **Stainless Steel Electrode Pins:**
   * Insert two $2.0\text{ mm}$ diameter 316L Stainless Steel pins into the tip holder spaced **$12.0\text{ mm}$** apart.
   * Connect the wire leads to the inner solder tabs.
3. **NTC Thermistor Capsule:**
   * Insert the $10\text{k}\Omega$ NTC thermistor head into the central metallic thermal probe pocket with thermally conductive epoxy (`3M TC-2810`).
4. **Testing Seal Integrity:**
   * Perform an air-pressure leak test ($5\text{ PSI}$) to verify IP54 water resistance before plugging the probe harness into headers `J3` and `J4` on the motherboard.
