import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

JOINT_COUNT = 8
_MAX_RAW    = 32767  # ADS1115 positive full-scale in single-ended mode


class Pots:
    def __init__(self, i2c) -> None:
        ads1 = ADS.ADS1115(i2c, address=0x48)
        ads2 = ADS.ADS1115(i2c, address=0x49)

        
        self._offsets: list[dict[str, float]] = [
            { 'plus': 0.13878, 'gain': 1 },  # joint 1  |  Right Hip
            { 'plus': 0.10498, 'gain': 1 },  # joint 2  |  Right Upper-leg
            { 'plus': 0.33442, 'gain': 1 },  # joint 3  |  Right Lower-leg
            { 'plus': 0.04059, 'gain':-1 },  # joint 4  |  Right Ankle
            { 'plus': 0.25929, 'gain': 1 },  # joint 5  |  Left Hip
            { 'plus': 0.62648, 'gain': 1 },  # joint 6  |  Left Upper-leg
            { 'plus': 0.08405, 'gain': 1 },  # joint 7  |  Left Lower-leg
            { 'plus': 0.46409, 'gain': 1 },  # joint 8  |  Left Ankle
        ]

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
            (max(0.0, min(1.0, ch.value / _MAX_RAW)) - self._offsets[i]['plus']) * self._offsets[i]['gain']
            for i, ch in enumerate(self._channels)
        ]

    def read_raw(self) -> list[int]:
        """Raw 16-bit ADC counts for all 8 joints."""
        return [ch.value for ch in self._channels]

    def read_one(self, joint: int) -> float:
        """
        Read a single joint (0-indexed) as a normalised float.
        Raises IndexError for out-of-range joints.
        """
        if not 0 <= joint < JOINT_COUNT:
            raise IndexError('Joint index out of range')
        return (max(0.0, min(1.0, self._channels[joint].value / _MAX_RAW)) - self._offsets[joint]['plus']) * self._offsets[joint]['gain']