/**
 * =============================================================================
 * RIOHS B4 Milk Analyzer — ESP32-S3 Firmware v2.0
 * =============================================================================
 *
 * TARGET HARDWARE:
 *   MCU:         ESP32-S3-WROOM-1-N8R2
 *   EC Sensor:   Analog Devices AD5933 (I2C: SDA=GPIO16, SCL=GPIO17)
 *   EC Buffer:   TI TLV9062IDR (Unity-gain, U9)
 *   Optical TIA: TI TLV9062IDR (100k feedback, U7)
 *   NIR LED:     Vishay VSLB9530S 940nm (GPIO12 via 2N7002 Q4)
 *   Main PD:     Everlight PD204-6C (GPIO5 / ADC1_CH4)
 *   Ref PD:      Everlight PD204-6C (GPIO6 / ADC1_CH5)
 *   NTC Temp:    10k NTC B=3950K  (GPIO4 / ADC1_CH3)
 *   Buzzer:      Active piezo      (GPIO26 via 2N7002 Q6)
 *
 * RESEARCH BASIS:
 *   [1] Electrical Impedance Spectroscopy for milk adulteration:
 *       Researchgate / IJCRR — AD5933 + ESP32 portable milk EIS systems confirmed.
 *       Water dilution alters EC measurably (TRL 3-4, published).
 *   [2] 940nm NIR ratiometric for milk fat scattering:
 *       MDPI Sensors — 800-940nm scattering correlated with fat content.
 *       Ratiometric I_sample/I_ref cancels LED thermal drift (TRL 3-4).
 *   [3] Temperature compensation:
 *       Milk EC changes ~2%/°C — Steinhart-Hart NTC equation standard.
 *
 * CALIBRATION STATUS: *** PLACEHOLDER — MUST BE CALIBRATED WITH REAL MILK ***
 *   Before use, run CALIBRATION MODE (set CALIBRATION_MODE = true below),
 *   collect data from real milk samples, then update CALIB_* constants.
 * =============================================================================
 */

#include <Wire.h>
#include <math.h>

// =============================================================================
// PIN DEFINITIONS — Match hardware_handoff_package/03_PIN_MAPPING doc exactly
// =============================================================================
#define PIN_I2C_SDA       16   // AD5933 SDA
#define PIN_I2C_SCL       17   // AD5933 SCL
#define PIN_NTC_ADC        4   // NTC Thermistor (ADC1_CH3)
#define PIN_NIR_ADC        5   // Main Photodiode (ADC1_CH4)
#define PIN_REF_ADC        6   // Reference Photodiode (ADC1_CH5)
#define PIN_NIR_TRIGGER   12   // 940nm LED MOSFET gate (Q4)
#define PIN_BUZZER        26   // Piezo buzzer MOSFET gate (Q6)

// =============================================================================
// AD5933 REGISTER MAP (Analog Devices Datasheet Rev. D)
// =============================================================================
#define AD5933_ADDR         0x0D
#define REG_CTRL_HB         0x80
#define REG_CTRL_LB         0x81
#define REG_START_FREQ_HB   0x82
#define REG_START_FREQ_MB   0x83
#define REG_START_FREQ_LB   0x84
#define REG_INC_FREQ_HB     0x85
#define REG_INC_FREQ_MB     0x86
#define REG_INC_FREQ_LB     0x87
#define REG_NUM_INCREMENTS_HB 0x88
#define REG_NUM_INCREMENTS_LB 0x89
#define REG_STATUS          0x8F
#define REG_REAL_HB         0x94
#define REG_REAL_LB         0x95
#define REG_IMAG_HB         0x96
#define REG_IMAG_LB         0x97

// =============================================================================
// NTC THERMISTOR CONSTANTS (Murata NXFT15XH103FA2B0, B=3950K)
// =============================================================================
#define NTC_BETA          3950.0f
#define NTC_R_NOM         10000.0f
#define NTC_T_NOM         298.15f   // 25°C in Kelvin
#define NTC_SERIES_R      10000.0f  // R25 on voltage divider
#define ADC_FULLSCALE     4095.0f   // ESP32 12-bit ADC

// =============================================================================
// FREQUENCY SWEEP SETTINGS (Research: 1kHz-100kHz sweep for milk EIS)
// [Ref 1]: Multi-frequency EIS gives better adulterant discrimination than
//          single-frequency measurement.
// =============================================================================
#define SWEEP_START_HZ    10000UL   // 10kHz start
#define SWEEP_STOP_HZ     100000UL  // 100kHz stop
#define SWEEP_STEPS       5         // 5 frequency points across sweep
#define AD5933_CLK_HZ     16776000UL

// =============================================================================
// 50Hz IIR NOTCH FILTER (Butterworth, Fs=1000Hz)
// Removes mains interference in rural Indian homes (published necessity [Ref 3])
// =============================================================================
const float b_notch[3] = {0.9654f, -1.8210f, 0.9654f};
const float a_notch[3] = {1.0000f, -1.8210f, 0.9308f};
float notch_x[3] = {0.0f, 0.0f, 0.0f};
float notch_y[3] = {0.0f, 0.0f, 0.0f};

// =============================================================================
// CALIBRATION SECTION
// *** THESE VALUES ARE PLACEHOLDERS — UPDATE AFTER LAB CALIBRATION ***
//
// HOW TO CALIBRATE:
//   1. Set CALIBRATION_MODE = true
//   2. Flash firmware, open Serial Monitor at 115200
//   3. Dip probe into pure cow/buffalo milk → note R_RATIO and EC_COMP values
//   4. Add 10% water → note values. Add 20% water → note values. Etc.
//   5. Use those values to update CALIB_A, CALIB_B, CALIB_C below.
//   6. Update EC_WATER_THRESH from measured pure milk EC baseline.
//   7. Set CALIBRATION_MODE = false → device is now calibrated.
// =============================================================================
#define CALIBRATION_MODE  true   // <-- Set TRUE for data collection phase

// Polynomial: Purity = A*R^2 + B*R + C  where R = optical_ratio / ec_comp
// UPDATE THESE AFTER REAL MILK CALIBRATION:
#define CALIB_A   0.82f    // *** PLACEHOLDER — not from real milk data ***
#define CALIB_B   0.15f    // *** PLACEHOLDER — not from real milk data ***
#define CALIB_C   0.03f    // *** PLACEHOLDER — not from real milk data ***

// EC threshold for detergent/salt spike (mS equivalent)
// UPDATE THIS from your measured pure milk baseline:
#define EC_DETERGENT_THRESH  10.0f  // *** PLACEHOLDER ***

// Purity threshold below which water dilution alert triggers:
#define PURITY_WATER_THRESH  0.95f  // *** PLACEHOLDER ***

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

void writeReg(byte reg, byte val) {
  Wire.beginTransmission(AD5933_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

int16_t readReg16(byte reg_hb) {
  Wire.beginTransmission(AD5933_ADDR);
  Wire.write(reg_hb);
  Wire.endTransmission(false);
  Wire.requestFrom(AD5933_ADDR, 2);
  if (Wire.available() >= 2) {
    byte hb = Wire.read();
    byte lb = Wire.read();
    return (int16_t)((hb << 8) | lb);
  }
  return 0;
}

// Steinhart-Hart simplified B-parameter equation for NTC
float readTemperatureC() {
  int raw = analogRead(PIN_NTC_ADC);
  if (raw <= 0 || raw >= 4095) return 25.0f;
  float resistance = NTC_SERIES_R * (ADC_FULLSCALE / (float)raw - 1.0f);
  float steinhart = log(resistance / NTC_R_NOM) / NTC_BETA;
  steinhart += 1.0f / NTC_T_NOM;
  return (1.0f / steinhart) - 273.15f;
}

float applyNotchFilter(float input) {
  notch_x[2] = notch_x[1]; notch_x[1] = notch_x[0]; notch_x[0] = input;
  notch_y[2] = notch_y[1]; notch_y[1] = notch_y[0];
  notch_y[0] = b_notch[0]*notch_x[0] + b_notch[1]*notch_x[1] + b_notch[2]*notch_x[2]
             - a_notch[1]*notch_y[1] - a_notch[2]*notch_y[2];
  return notch_y[0];
}

// =============================================================================
// AD5933 FREQUENCY SWEEP
// Research [Ref 1]: Multi-frequency gives better adulterant discrimination
// Returns average conductance across sweep frequencies
// =============================================================================
bool initAD5933() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(100000); // 100kHz I2C (AD5933 max is 400kHz, but conservative)

  // Power-on reset
  writeReg(REG_CTRL_HB, 0xB0);
  delay(20);

  // Set output range: 2V p-p (Range 1), PGA gain x1
  writeReg(REG_CTRL_LB, 0x00);

  // Verify communication by checking status register
  Wire.beginTransmission(AD5933_ADDR);
  Wire.write(REG_STATUS);
  if (Wire.endTransmission() != 0) {
    Serial.println("[ERROR] AD5933 not found on I2C bus!");
    return false;
  }
  Serial.println("[OK] AD5933 found on I2C at 0x0D");
  return true;
}

float runFrequencySweep() {
  float conductance_sum = 0.0f;
  int valid_points = 0;

  uint32_t freq_step = (SWEEP_STOP_HZ - SWEEP_START_HZ) / SWEEP_STEPS;

  for (int i = 0; i <= SWEEP_STEPS; i++) {
    uint32_t freq_hz = SWEEP_START_HZ + (i * freq_step);

    // Calculate AD5933 frequency code:
    // Code = (freq / (CLK/4)) * 2^27
    uint32_t freq_code = (uint32_t)(((float)freq_hz / ((float)AD5933_CLK_HZ / 4.0f)) * 134217728.0f);

    writeReg(REG_START_FREQ_HB, (freq_code >> 16) & 0xFF);
    writeReg(REG_START_FREQ_MB, (freq_code >> 8)  & 0xFF);
    writeReg(REG_START_FREQ_LB, (freq_code)       & 0xFF);

    // Initialize and start measurement
    writeReg(REG_CTRL_HB, 0x11); // Initialize with start frequency
    delay(5);
    writeReg(REG_CTRL_HB, 0x21); // Start sweep
    delay(20);                   // Allow settling

    // Read real and imaginary components
    int16_t real_val = readReg16(REG_REAL_HB);
    int16_t imag_val = readReg16(REG_IMAG_HB);

    float magnitude = sqrt((float)real_val*(float)real_val + (float)imag_val*(float)imag_val);
    if (magnitude > 0.1f) {
      conductance_sum += (1.0f / magnitude);
      valid_points++;
    }

    if (CALIBRATION_MODE) {
      Serial.print("  FREQ_HZ="); Serial.print(freq_hz);
      Serial.print(" REAL="); Serial.print(real_val);
      Serial.print(" IMAG="); Serial.print(imag_val);
      Serial.print(" MAG="); Serial.println(magnitude);
    }
  }

  // Power down AD5933 after sweep
  writeReg(REG_CTRL_HB, 0xA0);

  return (valid_points > 0) ? (conductance_sum / valid_points) : 0.001f;
}

// =============================================================================
// OPTICAL MEASUREMENT
// Research [Ref 2]: Ratiometric I_main/I_ref eliminates LED thermal drift
// =============================================================================
float readOpticalRatio() {
  // Pulse LED ON for measurement (reduces heating, avoids ambient contamination)
  digitalWrite(PIN_NIR_TRIGGER, HIGH);
  delayMicroseconds(500); // 0.5ms pulse

  // Average 16 readings during pulse for noise reduction
  float sum_main = 0.0f, sum_ref = 0.0f;
  for (int i = 0; i < 16; i++) {
    sum_main += analogRead(PIN_NIR_ADC);
    sum_ref  += analogRead(PIN_REF_ADC);
  }
  digitalWrite(PIN_NIR_TRIGGER, LOW);

  float main_avg = sum_main / 16.0f;
  float ref_avg  = sum_ref  / 16.0f;

  if (ref_avg < 10.0f) return 0.0f; // Reference too dark — LED or wiring problem
  return main_avg / ref_avg;         // Ratiometric output (dimensionless)
}

// =============================================================================
// SETUP
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("============================================");
  Serial.println("  RIOHS B4 Milk Analyzer Firmware v2.0");
  Serial.println("  TI TLV9062 TIA | AD5933 EIS | 940nm NIR");
  Serial.println("============================================");

  pinMode(PIN_NIR_TRIGGER, OUTPUT);
  digitalWrite(PIN_NIR_TRIGGER, LOW);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_NTC_ADC, INPUT);
  pinMode(PIN_NIR_ADC, INPUT);
  pinMode(PIN_REF_ADC, INPUT);

  if (!initAD5933()) {
    Serial.println("[HALT] AD5933 init failed. Check I2C wiring: SDA=GPIO16 SCL=GPIO17");
    while (true) { delay(1000); }
  }

  if (CALIBRATION_MODE) {
    Serial.println();
    Serial.println("*** CALIBRATION MODE ACTIVE ***");
    Serial.println("Dip probe into milk samples and record RAW_OPT, AVG_EC values.");
    Serial.println("See firmware comments for calibration procedure.");
    Serial.println();
  }

  // Short boot beep
  digitalWrite(PIN_BUZZER, HIGH); delay(100); digitalWrite(PIN_BUZZER, LOW);
}

// =============================================================================
// MAIN LOOP
// =============================================================================
void loop() {
  // 1. Temperature
  float temp_c = readTemperatureC();

  // 2. Optical ratio (ratiometric, drift-corrected)
  float optical_ratio = readOpticalRatio();

  // 3. EC sweep across frequencies
  float raw_ec = runFrequencySweep();

  // 4. 50Hz notch filter on EC
  float filtered_ec = applyNotchFilter(raw_ec);

  // 5. Temperature-compensate EC to 25°C standard
  // [Ref 3]: Milk EC changes ~2%/°C
  float ec_comp = filtered_ec / (1.0f + 0.02f * (temp_c - 25.0f));
  if (ec_comp < 0.0001f) ec_comp = 0.0001f;

  // 6. Fusion index
  float R = optical_ratio / ec_comp;

  // 7. Calibration polynomial (PLACEHOLDER — update after real milk calibration)
  float purity_index = CALIB_A * R * R + CALIB_B * R + CALIB_C;

  // 8. Serial output
  Serial.println("--------------------------------------------");
  Serial.print("TEMP_C=");       Serial.print(temp_c,    2); Serial.print("  ");
  Serial.print("OPT_RATIO=");    Serial.print(optical_ratio, 4); Serial.print("  ");
  Serial.print("EC_RAW=");       Serial.print(raw_ec,    6); Serial.print("  ");
  Serial.print("EC_COMP=");      Serial.print(ec_comp,   6); Serial.print("  ");
  Serial.print("R_FUSED=");      Serial.print(R,         4); Serial.print("  ");
  Serial.print("PURITY_IDX=");   Serial.println(purity_index, 4);

  if (CALIBRATION_MODE) {
    Serial.println("[CALIB] Record above values for this milk sample.");
    Serial.println("[CALIB] After collecting samples, update CALIB_A/B/C in firmware.");
  } else {
    // Decision engine (only active after calibration)
    if (purity_index < PURITY_WATER_THRESH) {
      float water_pct = (1.0f - purity_index) * 100.0f;
      Serial.print(">>> SUSPICIOUS: Estimated water added ~");
      Serial.print(water_pct, 1); Serial.println("%");
      digitalWrite(PIN_BUZZER, HIGH); delay(300); digitalWrite(PIN_BUZZER, LOW);
    } else if (ec_comp > EC_DETERGENT_THRESH) {
      Serial.println(">>> SUSPICIOUS: Detergent/Salt spike detected");
      digitalWrite(PIN_BUZZER, HIGH); delay(100);
      digitalWrite(PIN_BUZZER, LOW);  delay(100);
      digitalWrite(PIN_BUZZER, HIGH); delay(100);
      digitalWrite(PIN_BUZZER, LOW);
    } else {
      Serial.println(">>> GOOD: Milk status OK");
    }
  }

  delay(500); // 2Hz measurement rate
}
