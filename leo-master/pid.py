"""
pid.py - PID controllers for LEO joint position control.
The class is self-contained and only depends on simple_pid plus injected callbacks.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Callable, Mapping, Sequence

from simple_pid import PID as SimplePID

log = logging.getLogger(__name__)

CONTROL_HZ = 50
NUM_JOINTS = 8
TARGET_MIN = -1.0
TARGET_MAX = 1.0
MOTOR_MIN = -1.0
MOTOR_MAX = 1.0


@dataclass(frozen=True)
class JointConfig:
    name: str
    motors: tuple[str, str]
    opposite_directions: bool = False


class Pid:
    def __init__(
        self,
        joint_configs: Sequence[JointConfig],
        read_position_fn: Callable[[str], float],
        set_motor_fn: Callable[[str, float], None],
        *,
        kp: float = 1.0,
        ki: float = 0.0,
        kd: float = 0.0,
        sample_rate_hz: int = CONTROL_HZ,
    ) -> None:
        if len(joint_configs) != NUM_JOINTS:
            raise ValueError(f"Expected {NUM_JOINTS} joint configs, got {len(joint_configs)}")

        self._joint_configs = list(joint_configs)
        self._read_position = read_position_fn
        self._set_motor = set_motor_fn
        self._sample_rate_hz = sample_rate_hz

        self._controllers: list[SimplePID] = [
            SimplePID(kp, ki, kd, setpoint=0.0, output_limits=(MOTOR_MIN, MOTOR_MAX), sample_time=None)
            for _ in range(NUM_JOINTS)
        ]
        self._targets: dict[str, float] = {config.name: 0.0 for config in self._joint_configs}
        self._control_task: asyncio.Task[None] | None = None
        self._running = False

        log.info("PID controller initialised for %d joints", NUM_JOINTS)

    @property
    def running(self) -> bool:
        return self._running

    def start(self) -> None:
        if self._running:
            return

        self._running = True
        self._control_task = asyncio.create_task(self._control_loop())
        log.info("PID control loop started at %d Hz", self._sample_rate_hz)

    def stop(self) -> None:
        self._running = False

        if self._control_task is not None:
            self._control_task.cancel()
            self._control_task = None

        self._coast_all()
        self._reset_controllers()
        log.info("PID control loop stopped")

    def set_target(self, joint: str, value: float) -> None:
        if joint not in self._targets:
            raise KeyError(f"Unknown joint: {joint}")

        clamped = max(TARGET_MIN, min(TARGET_MAX, value))
        self._targets[joint] = clamped
        self._controller_for(joint).setpoint = clamped

    def set_targets(self, targets: Mapping[str, float]) -> None:
        for joint, value in targets.items():
            self.set_target(joint, value)

    def get_target(self, joint: str) -> float:
        if joint not in self._targets:
            raise KeyError(f"Unknown joint: {joint}")
        return self._targets[joint]

    def get_targets(self) -> dict[str, float]:
        return dict(self._targets)

    def snapshot(self) -> dict[str, object]:
        return {
            "running": self._running,
            "targets": self.get_targets(),
        }

    def _controller_for(self, joint: str) -> SimplePID:
        for index, config in enumerate(self._joint_configs):
            if config.name == joint:
                return self._controllers[index]
        raise KeyError(f"Unknown joint: {joint}")

    def _coast_all(self) -> None:
        for config in self._joint_configs:
            self._set_motor(config.motors[0], 0.0)
            self._set_motor(config.motors[1], 0.0)

    def _reset_controllers(self) -> None:
        for controller in self._controllers:
            controller.reset()

    def _drive_joint(self, config: JointConfig, output: float) -> None:
        first_motor_value = output
        second_motor_value = -output if config.opposite_directions else output
        self._set_motor(config.motors[0], first_motor_value)
        self._set_motor(config.motors[1], second_motor_value)

    async def _control_loop(self) -> None:
        interval = 1.0 / self._sample_rate_hz

        try:
            while self._running:
                try:
                    for index, config in enumerate(self._joint_configs):
                        current_position = self._read_position(config.name)
                        output = self._controllers[index](current_position)
                        output = max(MOTOR_MIN, min(MOTOR_MAX, output))
                        self._drive_joint(config, output)
                except Exception as exc:
                    log.warning("PID control error: %s", exc)

                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            pass
