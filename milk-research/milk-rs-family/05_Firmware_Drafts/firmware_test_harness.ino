/**
 * RIOHS Dip-In Milk Analyzer: ESP32-S3 Firmware Test Harness (Phase 5.5)
 * 
 * Target Hardware: ESP32-S3-WROOM-1, AD5933 Impedance SoC, OPA350 Buffer, 
 * Vishay VSLB9530S 940nm LED, Everlight PD204-6C Photodiodes, Murata NTC.
 * 
 * Description:
 * This sketch implements I2C configuration for the AD5933 converter,
 * reads raw optical and EC parameters, runs a 50Hz IIR notch filter,
 * applies temperature compensation, and calculates the Purity Index.
 */

#include <Wire.h>
#include <math.h>

// --- Pin Definitions (ESP32-S3) ---
#define I2C_SDA_PIN      16
#define I2C_SCL_PIN      17
#define PIN_NTC_ADC      4
#define PIN_NIR_ADC      5
#define PIN_REF_ADC      6
#define PIN_PZT_PWM      12

// --- AD5933 Register Addresses ---
#define AD5933_ADDR      0x0D // Standard I2C address
#define REG_CONTROL_HB   0x80 // Control Register High Byte
#define REG_CONTROL_LB   0x81 // Control Register Low Byte
#define REG_START_FREQ_0 0x82 // Start Frequency 24-bit (HB)
#define REG_START_FREQ_1 0x83
#define REG_START_FREQ_2 0x84 // Start Frequency 24-bit (LB)
#define REG_REAL_DATA_HB 0x94 // Real Data Register (HB)
#define REG_REAL_DATA_LB 0x95 // Real Data Register (LB)
#define REG_IMAG_DATA_HB 0x96 // Imaginary Data Register (HB)
#define REG_IMAG_DATA_LB 0x97 // Imaginary Data Register (LB)

// --- Constants & Calibration Parameters ---
#define NTC_BETA         4250.0 // Beta value of Murata NTC
#define NTC_R_NOMINAL    10000.0 // Resistance at 25C
#define NTC_T_NOMINAL    298.15  // 25C in Kelvin
#define NTC_SERIES_R     10000.0 // Series resistor in voltage divider
#define ADC_MAX_VAL      4095.0  // 12-bit ADC full-scale

// --- 50Hz IIR Butterworth Notch Filter Coefficients (Fs = 1000Hz) ---
// Formula: y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
const float b_coeff[3] = {0.9654f, -1.8210f, 0.9654f};
const float a_coeff[3] = {1.0000f, -1.8210f, 0.9308f};
float x_history[3] = {0.0f, 0.0f, 0.0f};
float y_history[3] = {0.0f, 0.0f, 0.0f};

// --- Helper: Write Byte to I2C Register ---
void writeReg(byte reg, byte val) {
  Wire.beginTransmission(AD5933_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

// --- Helper: Read 16-bit word from I2C ---
int16_t readWord(byte reg_hb) {
  Wire.beginTransmission(AD5933_ADDR);
  Wire.write(reg_hb);
  Wire.endTransmission();
  
  Wire.requestFrom(AD5933_ADDR, 2);
  if (Wire.available() >= 2) {
    byte hb = Wire.read();
    byte lb = Wire.read();
    return (int16_t)((hb << 8) | lb);
  }
  return 0;
}

// --- Temperature Measurement (Steinhart-Hart Equation) ---
float readTemperature() {
  int raw = analogRead(PIN_NTC_ADC);
  if (raw == 0) return 25.0f; // Prevent division by zero
  
  float resistance = NTC_SERIES_R * (ADC_MAX_VAL / (float)raw - 1.0f);
  float steinhart;
  steinhart = resistance / NTC_R_NOMINAL;     // R/Ro
  steinhart = log(steinhart);                  // ln(R/Ro)
  steinhart /= NTC_BETA;                       // 1/B * ln(R/Ro)
  steinhart += 1.0f / NTC_T_NOMINAL;           // + (1/To)
  steinhart = 1.0f / steinhart;                // Invert to absolute Temp
  steinhart -= 273.15f;                        // Convert to Celsius
  return steinhart;
}

// --- 50Hz Notch Filter Application ---
float applyNotch(float input_sample) {
  // Shift history
  x_history[2] = x_history[1];
  x_history[1] = x_history[0];
  x_history[0] = input_sample;
  
  y_history[2] = y_history[1];
  y_history[1] = y_history[0];
  
  // Difference equation calculation
  y_history[0] = b_coeff[0]*x_history[0] + b_coeff[1]*x_history[1] + b_coeff[2]*x_history[2]
                 - a_coeff[1]*y_history[1] - a_coeff[2]*y_history[2];
                 
  return y_history[0];
}

// --- Initialise AD5933 Impedance SoC ---
void initAD5933() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  
  // 1. Set Start Frequency to 100 kHz (assuming 16.776MHz external/internal clock)
  // Formula: Frequency Code = (Frequency / (CLK/4)) * 2^27
  // For 100kHz: (100000 / 4194000) * 134217728 = 3200000 (0x30D400)
  writeReg(REG_START_FREQ_0, 0x30);
  writeReg(REG_START_FREQ_1, 0xD4);
  writeReg(REG_START_FREQ_2, 0x00);
  
  // 2. Set Excitation Range to 2V p-p (Range 1), gain setting = x1
  writeReg(REG_CONTROL_HB, 0x01); // Standby Mode
  delay(10);
  writeReg(REG_CONTROL_HB, 0x11); // Initialize with Start Frequency
  delay(10);
  writeReg(REG_CONTROL_HB, 0x21); // Start Frequency Sweep
}

// --- Read Impedance Magnitude from AD5933 ---
float readImpedanceMagnitude() {
  int16_t real = readWord(REG_REAL_DATA_HB);
  int16_t imag = readWord(REG_IMAG_DATA_HB);
  
  // Calculate magnitude: sqrt(R^2 + I^2)
  float magnitude = sqrt(pow(real, 2) + pow(imag, 2));
  
  // Convert magnitude to relative conductance (G = 1 / Z)
  if (magnitude == 0.0f) return 0.001f;
  return 1.0f / magnitude; 
}

void setup() {
  Serial.begin(115200);
  
  // Initialize GPIOs
  pinMode(PIN_NTC_ADC, INPUT);
  pinMode(PIN_NIR_ADC, INPUT);
  pinMode(PIN_REF_ADC, INPUT);
  pinMode(PIN_PZT_PWM, OUTPUT);
  digitalWrite(PIN_PZT_PWM, LOW);
  
  // Initialize I2C and AD5933
  initAD5933();
  
  Serial.println("--- RIOHS Dip-In Test Harness Initialized ---");
}

void loop() {
  // 1. Read temperature and raw inputs
  float temp_c = readTemperature();
  float raw_nir = analogRead(PIN_NIR_ADC);
  float raw_ref = analogRead(PIN_REF_ADC);
  float raw_ec = readImpedanceMagnitude();
  
  // Prevent division by zero
  if (raw_ref == 0.0f) raw_ref = 1.0f;
  
  // 2. Apply DSP noise rejection (50Hz Notch Filter) to EC reading
  float filtered_ec = applyNotch(raw_ec);
  
  // 3. Apply Temperature Compensation to EC (adjusted to 25C standard reference)
  // Milk EC changes by ~2% per degree C
  float ec_comp = filtered_ec / (1.0f + 0.02f * (temp_c - 25.0f));
  
  // 4. Calculate Ratiometric Optical/Conductance Index
  float optical_ratio = raw_nir / raw_ref;
  if (ec_comp == 0.0f) ec_comp = 0.001f;
  float R = optical_ratio / ec_comp;
  
  // 5. Apply Calibration Polynomial: Purity = 0.82R^2 + 0.15R + 0.03
  float purity_index = 0.82f * pow(R, 2) + 0.15f * R + 0.03f;
  
  // 6. Print Serial telemetry (useful for Exp 2 and Exp 6 testing)
  Serial.print("TEMP_C:"); Serial.print(temp_c); Serial.print(",");
  Serial.print("RAW_NIR:"); Serial.print(raw_nir); Serial.print(",");
  Serial.print("FILT_EC:"); Serial.print(filtered_ec); Serial.print(",");
  Serial.print("COMP_EC:"); Serial.print(ec_comp); Serial.print(",");
  Serial.print("R_RATIO:"); Serial.print(R); Serial.print(",");
  Serial.print("PURITY:"); Serial.println(purity_index);
  
  // 7. Decision Engine simple logic (Phase 5.5 UX targets)
  if (purity_index < 0.95f) {
    // Water dilution detected (Expected LOD > 5%)
    float water_pct = (1.0f - purity_index) * 100.0f;
    Serial.print(">>> STATE: SUSPICIOUS | Added Water Estimate: ");
    Serial.print(water_pct);
    Serial.println("%");
  } else if (ec_comp > 10.0f) {
    // High conductance indicates detergent or salt spike
    Serial.println(">>> STATE: SUSPICIOUS | Detergent/Salt Risk: HIGH");
  } else {
    Serial.println(">>> STATE: GOOD | Milk status verified.");
  }
  
  delay(100); // 10Hz log frequency
}
