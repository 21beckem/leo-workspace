"""
leo.py — The LEO robot.
Owns the I2C bus, motors, and pots. Holds all live robot state.
start.py imports this and calls into it; LEO knows nothing about the network.
"""

import asyncio
import atexit
import logging

import board
import busio

from motors import Motors
from pots   import Pots

from power_off_pi import power_off_pi

log = logging.getLogger(__name__)

POT_POLL_HZ = 20  # how often to read the potentiometers


class LEO:
    def __init__(self) -> None:
        global existingInstance

        if existingInstance is not None:
            raise RuntimeError("LEO instance already exists")
        
        self.destroyed = False
        # Single shared I2C bus — PCA9685, ADS1115 #1, and ADS1115 #2 all live here
        self._i2c = busio.I2C(board.SCL, board.SDA)

        self._motors = Motors(self._i2c)
        self._pots   = Pots(self._i2c)

        # Live pot state — updated continuously by the polling loop.
        # Each entry is a normalised float in [0.0, 1.0].
        # Index 0 = joint 1, index 7 = joint 8.
        self.pot_names: list[str] = [
            "R-H", # Right Hip
            "R-U", # Right Upper-leg
            "R-L", # Right Lower-leg
            "R-A", # Right Ankle
            "L-H", # Left Hip
            "L-U", # Left Upper-leg
            "L-L", # Left Lower-leg
            "L-A", # Left Ankle
        ]
        self.pot_values: dict[str, int] = {
            self.pot_names[0]: 0.0, # Right Hip
            self.pot_names[1]: 0.0, # Right Upper-leg
            self.pot_names[2]: 0.0, # Right Lower-leg
            self.pot_names[3]: 0.0, # Right Ankle
            self.pot_names[4]: 0.0, # Left Hip
            self.pot_names[5]: 0.0, # Left Upper-leg
            self.pot_names[6]: 0.0, # Left Lower-leg
            self.pot_names[7]: 0.0, # Left Ankle
        }

        self._poll_task: asyncio.Task | None = None

        atexit.register(self._motors.stop_all)

        existingInstance = self

        log.info("LEO initialised — motors and pots ready")

    # ── Motor API ────────────────────────────────────────────────────────────

    @property
    def motor_names(self) -> set[str]:
        if self.destroyed:
            return set()
        return self._motors.names

    def set_motor(self, name: str, value: float) -> None:
        """Set motor `name` to power `value` in [-1.0, 1.0]."""
        if not self.destroyed:
            self._motors.set(name, value)

    def stop_all(self) -> None:
        """Coast all motors immediately."""
        if not self.destroyed:
            self._motors.stop_all()
            log.info("All motors stopped")

    # ── Pot polling ──────────────────────────────────────────────────────────

    def start_polling(self) -> None:
        """
        Launch the background pot-reading loop.
        Must be called from inside a running asyncio event loop
        (i.e. after the aiohttp app has started).
        """
        if self.destroyed:
            return
        if self._poll_task and not self._poll_task.done():
            return  # already running
        self._poll_task = asyncio.create_task(self._poll_loop())
        log.info("Pot polling started at %d Hz", POT_POLL_HZ)

    def stop_polling(self) -> None:
        if self.destroyed:
            return
        if self._poll_task:
            self._poll_task.cancel()
            self._poll_task = None

    async def _poll_loop(self) -> None:
        interval = 1.0 / POT_POLL_HZ
        while True:
            try:
                self.pot_values = dict(zip(
                    self.pot_names,
                    self._pots.read_all()
                ))
            except Exception as exc:
                log.warning("Pot read error: %s", exc)
            await asyncio.sleep(interval)

    # ── System ───────────────────────────────────────────────────────────────

    def power_off(self) -> None:
        """Stop all motors, then shut the Pi down."""
        if not self.destroyed:
            self.stop_all()
            self.stop_polling()
            log.info("Powering off")
            self.destroyed = True

            global existingInstance
            existingInstance = None

            power_off_pi()


existingInstance: LEO | None = None  # for atexit cleanup