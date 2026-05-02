#!/home/michael/leo-workspace/py/bin/python
"""
test_ads1115.py — Read all 8 joint potentiometers on LEO
Two ADS1115 boards on the Pi's I2C bus:
  Board 1 @ 0x48 (ADDR → GND) → joints 1-4
  Board 2 @ 0x49 (ADDR → VDD) → joints 5-8
Stop: Ctrl-C
"""

import time
import board
import busio
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

# ── I2C bus (same one the PCA9685 already uses) ───────────────────────────────
i2c = busio.I2C(board.SCL, board.SDA)

# ── Two ADS1115 boards ────────────────────────────────────────────────────────
ads1 = ADS.ADS1115(i2c, address=0x48)  # ADDR → GND  → joints 1–4
ads2 = ADS.ADS1115(i2c, address=0x49)  # ADDR → VDD  → joints 5–8

# ── One AnalogIn channel per joint ───────────────────────────────────────────
joints = [
    AnalogIn(ads1, 0),  # Joint 1
    AnalogIn(ads1, 1),  # Joint 2
    AnalogIn(ads1, 2),  # Joint 3
    AnalogIn(ads1, 3),  # Joint 4
    AnalogIn(ads2, 0),  # Joint 5
    AnalogIn(ads2, 1),  # Joint 6
    AnalogIn(ads2, 2),  # Joint 7
    AnalogIn(ads2, 3),  # Joint 8
]

print("Reading LEO's joint potentiometers — Ctrl-C to stop\n")

try:
    while True:
        readings = [ch.value for ch in joints]  # raw 16-bit ADC values (0–32767)
        normalized = [v / 32767 for v in readings]  # 0.0 – 1.0

        line = "  ".join(
            f"J{i+1}: {norm:5.3f}  ({raw:5d})"
            for i, (raw, norm) in enumerate(zip(readings, normalized))
        )
        print(line, end="\r")
        time.sleep(0.05)  # ~20 Hz

except KeyboardInterrupt:
    print("\nDone.")