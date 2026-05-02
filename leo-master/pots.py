"""
pots.py — ADS1115 potentiometer reading for LEO
Knows nothing about the network, motors, or anything else.

Wiring:
  ADS1115 #1  ADDR → GND  →  address 0x48  →  joints 1–4 (channels A0–A3)
  ADS1115 #2  ADDR → VDD  →  address 0x49  →  joints 5–8 (channels A0–A3)
"""

import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

JOINT_COUNT = 8
_MAX_RAW    = 32767  # ADS1115 positive full-scale in single-ended mode


class Pots:
    def __init__(self, i2c) -> None:
        ads1 = ADS.ADS1115(i2c, address=0x48)
        ads2 = ADS.ADS1115(i2c, address=0x49)

        self._channels: list[AnalogIn] = [
            AnalogIn(ads1, 1),  # joint 1  |  Right Hip
            AnalogIn(ads1, 3),  # joint 2  |  Right Upper-leg
            AnalogIn(ads2, 3),  # joint 3  |  Right Lower-leg
            AnalogIn(ads2, 1),  # joint 4  |  Right Ankle
            AnalogIn(ads1, 0),  # joint 5  |  Left Hip
            AnalogIn(ads1, 2),  # joint 6  |  Left Upper-leg
            AnalogIn(ads2, 2),  # joint 7  |  Left Lower-leg
            AnalogIn(ads2, 0),  # joint 8  |  Left Ankle
        ]

    def read_all(self) -> list[float]:
        """
        Read all 8 joints and return normalised values in [0.0, 1.0].
        Index 0 = joint 1, index 7 = joint 8.
        """
        return [
            max(0.0, min(1.0, ch.value / _MAX_RAW))
            for ch in self._channels
        ]

    def read_raw(self) -> list[int]:
        """Raw 16-bit ADC counts for all 8 joints."""
        return [ch.value for ch in self._channels]

    def read_one(self, joint: int) -> float:
        """
        Read a single joint (0-indexed) as a normalised float.
        Raises IndexError for out-of-range joints.
        """
        return max(0.0, min(1.0, self._channels[joint].value / _MAX_RAW))