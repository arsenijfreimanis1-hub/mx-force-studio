/*
 * Six servo needles for MX Bikes Force Studio.
 *
 * PCA9685 at 0x40. Uno A4 = SDA, A5 = SCL. Logic VCC from the Uno.
 * Servo V+ from a separate 5 V supply. Tie that ground to Uno GND.
 * Do not power the servos from the Uno 5 V pin.
 *
 * USB serial 115200 8N1. One line, six integers 0–180, no spaces:
 *   speed,rpm,throttle,frontBrake,gear,roll
 * Channels 0–5 in that order. A bad line is ignored.
 */

#include <Wire.h>

static const uint8_t PCA = 0x40;
static const uint8_t MODE1 = 0x00;
static const uint8_t MODE2 = 0x01;
static const uint8_t PRESCALE = 0xFE;
static const uint8_t LED0 = 0x06;

static char line[48];
static uint8_t lineLen = 0;

static void writeReg(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(PCA);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

static uint16_t angleToTick(int angle) {
  if (angle < 0) angle = 0;
  if (angle > 180) angle = 180;
  const uint32_t us = 500u + (uint32_t)angle * 1900u / 180u;
  return (uint16_t)((us * 4096u) / 20000u);
}

static void setChannel(uint8_t channel, int angle) {
  const uint16_t off = angleToTick(angle);
  Wire.beginTransmission(PCA);
  Wire.write(LED0 + 4 * channel);
  Wire.write((uint8_t)0);
  Wire.write((uint8_t)0);
  Wire.write((uint8_t)(off & 0xFF));
  Wire.write((uint8_t)(off >> 8));
  Wire.endTransmission();
}

static void pcaBegin() {
  Wire.begin();
  writeReg(MODE1, 0x10);
  writeReg(PRESCALE, 121);
  writeReg(MODE2, 0x04);
  writeReg(MODE1, 0x20);
  delay(1);
  writeReg(MODE1, 0xA1);
  for (uint8_t channel = 0; channel < 6; channel++) setChannel(channel, 90);
}

static bool parseSix(const char *text, int out[6]) {
  for (int i = 0; i < 6; i++) {
    if (*text < '0' || *text > '9') return false;
    int value = 0;
    while (*text >= '0' && *text <= '9') {
      value = value * 10 + (*text - '0');
      if (value > 180) return false;
      text++;
    }
    out[i] = value;
    if (i < 5) {
      if (*text != ',') return false;
      text++;
    }
  }
  return *text == '\0';
}

static void applyLine(const char *text) {
  int angles[6];
  if (!parseSix(text, angles)) return;
  for (uint8_t channel = 0; channel < 6; channel++) setChannel(channel, angles[channel]);
}

void setup() {
  Serial.begin(115200);
  pcaBegin();
}

void loop() {
  while (Serial.available() > 0) {
    const char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (lineLen > 0) {
        line[lineLen] = '\0';
        applyLine(line);
        lineLen = 0;
      }
      continue;
    }
    if (lineLen < sizeof(line) - 1) {
      line[lineLen++] = c;
    } else {
      lineLen = 0;
    }
  }
}
