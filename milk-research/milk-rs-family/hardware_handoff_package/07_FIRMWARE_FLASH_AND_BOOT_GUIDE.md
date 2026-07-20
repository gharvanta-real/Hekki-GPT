# ⚡ 07 - Firmware Flash & Boot Guide (0% to First Boot)

This document explains step-by-step how to flash firmware onto the ESP32-S3 board and how to boot it for the first time. No experience required.

---

## 🛠️ 1. Tools Required (Install These First)

| Tool | Download Link | Purpose |
| :--- | :--- | :--- |
| **Arduino IDE 2.x** | https://www.arduino.cc/en/software | Firmware upload tool |
| **ESP32 Board Package** | Install via Arduino IDE Board Manager | ESP32-S3 support |
| **CH340C USB Driver** | https://www.wch-ic.com/downloads/CH341SER_EXE.html | USB-to-Serial for Windows |

### Install ESP32 Board Package in Arduino IDE:
1. Open Arduino IDE → **File → Preferences**
2. In "Additional Board Manager URLs", paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Go to **Tools → Board → Boards Manager**
4. Search `esp32` → Install **"esp32 by Espressif Systems"** (version 3.x)

---

## 🔌 2. Hardware Connection (Before First Flash)

1. Connect a **USB-C cable** from your PC to the **J1 USB-C port** on the motherboard.
2. The **CH340C USB-UART bridge** (`U6`) converts PC USB to ESP32 UART.
3. The **auto-reset circuit** (`Q2`, `Q3` S8050 transistors) automatically puts the ESP32 into bootloader mode — **no manual button pressing needed** if circuit is correct.

### If auto-reset is NOT working (manual boot method):
```
Step 1: Press and HOLD the BOOT button (SW3 → IO0 pin, GPIO0)
Step 2: While holding BOOT, press and release the RESET button (SW2 → EN pin)
Step 3: Release the BOOT button
Step 4: ESP32 is now in bootloader mode — upload firmware from Arduino IDE
```

---

## 💻 3. Arduino IDE Board Settings

Go to **Tools** menu and set exactly:

| Setting | Value |
| :--- | :--- |
| **Board** | `ESP32S3 Dev Module` |
| **Port** | `COMx` (whichever appears when USB is connected) |
| **USB CDC On Boot** | `Enabled` |
| **Flash Mode** | `QIO 80MHz` |
| **Flash Size** | `8MB (64Mb)` |
| **Partition Scheme** | `8M with spiffs (3MB APP/1.5MB SPIFFS)` |
| **PSRAM** | `OPI PSRAM` |
| **Upload Speed** | `921600` |
| **Core Debug Level** | `None` |

---

## 📤 4. Upload Firmware (Step by Step)

1. Open the firmware file **`firmware_test_harness.ino`** in Arduino IDE.
2. Make sure the board settings above are correct.
3. Click the **Upload button** (→ arrow icon) or press `Ctrl+U`.
4. Arduino IDE will compile and then upload — this takes about 30–60 seconds.
5. You will see:
   ```
   Connecting......
   Chip is ESP32-S3 (QFN56) (revision v0.2)
   Uploading stub...
   Running stub...
   Changing baud rate to 921600
   Changed.
   Configuring flash size...
   Writing at 0x00010000... (100 %)
   Hash of data verified.
   Leaving...
   Hard resetting via RTS pin...
   ```
6. The ESP32 will automatically reset and run the firmware. ✅

---

## 🔍 5. Serial Monitor Debug (Verify Everything Works)

1. In Arduino IDE, open **Tools → Serial Monitor** (or press `Ctrl+Shift+M`).
2. Set baud rate to **`115200`**.
3. You should see output like:
   ```
   RIOHS B4 Milk Analyzer — Boot OK
   AD5933 Init: OK (I2C 0x0D)
   NTC Temp: 26.4 C
   OPT_MAIN ADC: 2187  OPT_REF ADC: 2034
   Purity Index: 0.94
   ```

If you see **`AD5933 Init: FAIL`** — check the I2C wiring (`SDA=GPIO1`, `SCL=GPIO2`, both 4.7k pull-ups to 3.3V).

---

## 🔁 6. Auto-Reset Circuit Wiring (CH340C → ESP32)

This circuit allows Arduino IDE to automatically put ESP32 into bootloader without pressing buttons:

```
CH340C Pin 5 (DTR) ──────────────── Q2 (S8050 NPN) Base
                                         │
CH340C Pin 13 (RTS) ─────────────── Q3 (S8050 NPN) Base

Q2 Collector ──── ESP32 GPIO0 (IO0/BOOT pin)
Q3 Collector ──── ESP32 EN (RESET pin)

Both Q2, Q3 Emitters ──── GND

100Ω Resistors in series with each Base input.
10k Pull-up on GPIO0 to 3.3V.
10k Pull-up + 10µF cap on EN to 3.3V (RC reset circuit).
```
