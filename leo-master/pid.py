"""
pid.py - PID controllers for LEO joint position control.
The class is self-contained and only depends on simple_pid plus injected callbacks.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Callable, Mapping, Sequence, Literal

from simple_pid import PID as SimplePID

log = logging.getLogger(__name__)

CONTROL_HZ = 50
NUM_JOINTS = 8
TARGET_MIN = -1.0
TARGET_MAX = 1.0
MOTOR_MIN = -1.0
MOTOR_MAX = 1.0
JointKind = Literal["additive", "difference"]


@dataclass(frozen=True)
class JointConfig:
    name: str
    motors: tuple[str, str]
    kind: JointKind


@dataclass(frozen=True)
class MotorPairConfig:
    motors: tuple[str, str]
    additive_joint: str
    difference_joint: str


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

        self._joint_by_name: dict[str, JointConfig] = {}
        self._controllers_by_joint: dict[str, SimplePID] = {}
        self._pair_configs: list[MotorPairConfig] = []

        pair_map: dict[tuple[str, str], dict[JointKind, JointConfig]] = {}
        for config in self._joint_configs:
            if config.name in self._joint_by_name:
                raise ValueError(f"Duplicate joint name: {config.name}")
            self._joint_by_name[config.name] = config

            key = tuple(config.motors)
            slot = pair_map.setdefault(key, {})
            if config.kind in slot:
                raise ValueError(f"Duplicate {config.kind} joint for motor pair {config.motors}")
            slot[config.kind] = config

        for motor_pair, slot in pair_map.items():
            additive = slot.get("additive")
            difference = slot.get("difference")
            if additive is None or difference is None:
                raise ValueError(f"Motor pair {motor_pair} must have one additive joint and one difference joint")
            self._pair_configs.append(
                MotorPairConfig(
                    motors=motor_pair,
                    additive_joint=additive.name,
                    difference_joint=difference.name,
                )
            )

        self._controllers: list[SimplePID] = []
        self._targets: dict[str, float] = {}
        for config in self._joint_configs:
            controller = SimplePID(kp, ki, kd, setpoint=0.0, output_limits=(MOTOR_MIN, MOTOR_MAX), sample_time=None)
            self._controllers.append(controller)
            self._controllers_by_joint[config.name] = controller
            self._targets[config.name] = 0.0
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
        try:
            return self._controllers_by_joint[joint]
        except KeyError as exc:
            raise KeyError(f"Unknown joint: {joint}") from exc

    def _coast_all(self) -> None:
        for config in self._joint_configs:
            self._set_motor(config.motors[0], 0.0)
            self._set_motor(config.motors[1], 0.0)

    def _reset_controllers(self) -> None:
        for controller in self._controllers:
            controller.reset()

    def _drive_pair(self, pair: MotorPairConfig) -> None:
        additive_controller = self._controller_for(pair.additive_joint)
        difference_controller = self._controller_for(pair.difference_joint)

        additive_joint_value = self._read_position(pair.additive_joint)
        difference_joint_value = self._read_position(pair.difference_joint)

        additive_output = additive_controller(additive_joint_value)
        difference_output = difference_controller(difference_joint_value)

        motor_1 = self._mix_motor_output(additive_output, difference_output, first_motor=True)
        motor_2 = self._mix_motor_output(additive_output, difference_output, first_motor=False)

        self._set_motor(pair.motors[0], motor_2)
        self._set_motor(pair.motors[1], motor_1)

    def _mix_motor_output(self, additive_output: float, difference_output: float, *, first_motor: bool) -> float:
        if first_motor:
            value = additive_output + difference_output
        else:
            value = additive_output - difference_output
        return max(MOTOR_MIN, min(MOTOR_MAX, value))

    async def _control_loop(self) -> None:
        interval = 1.0 / self._sample_rate_hz

        try:
            while self._running:
                try:
                    for pair in self._pair_configs:
                        self._drive_pair(pair)
                except Exception as exc:
                    log.warning("PID control error: %s", exc)

                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            pass
