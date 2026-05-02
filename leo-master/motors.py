"""
motors.py — PCA9685 motor control for LEO
Knows nothing about the network, pots, or anything else.
"""

import adafruit_pca9685

MAX_DUTY = 65535  # 16-bit full scale

# (channel_A, channel_B) — positive value drives A, negative drives B
_CHANNEL_MAP: dict[str, tuple[int, int]] = {
    "A": (0,  1),
    "B": (10, 11),
    "C": (2,  3),
    "D": (9,  8),
    "E": (4,  5),
    "F": (14, 15),
    "G": (13, 12),
    "H": (6,  7),
}


class Motors:
    def __init__(self, i2c) -> None:
        self._pca = adafruit_pca9685.PCA9685(i2c)
        self._pca.frequency = 60
        # Resolve channel objects once at startup
        self._motors: dict[str, tuple] = {
            name: (self._pca.channels[a], self._pca.channels[b])
            for name, (a, b) in _CHANNEL_MAP.items()
        }

    @property
    def names(self) -> set[str]:
        """Set of valid motor name strings."""
        return set(self._motors.keys())

    def set(self, name: str, value: float) -> None:
        """
        Drive a motor at normalised power.
          value =  1.0  → full power, channel-A direction
          value = -1.0  → full power, channel-B direction
          value =  0.0  → coast (both channels off)
        Clamped to [-1, 1].
        """
        value = max(-1.0, min(1.0, value))
        ch_a, ch_b = self._motors[name]
        duty = int(abs(value) * MAX_DUTY)

        if value > 0:
            ch_b.duty_cycle = 0
            ch_a.duty_cycle = duty
        elif value < 0:
            ch_a.duty_cycle = 0
            ch_b.duty_cycle = duty
        else:
            ch_a.duty_cycle = 0
            ch_b.duty_cycle = 0

    def stop_all(self) -> None:
        """Zero every PCA9685 channel — all motors coast immediately."""
        for i in range(16):
            self._pca.channels[i].duty_cycle = 0