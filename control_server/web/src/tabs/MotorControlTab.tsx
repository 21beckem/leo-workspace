import { Component, For } from 'solid-js';
import { MOTOR_NAMES, createMotionStore, createPidStore } from '../stores';
import { SliderCard } from '../components/SliderCard';

interface MotorControlTabProps {
  motion: ReturnType<typeof createMotionStore>;
  pid?: ReturnType<typeof createPidStore>;
}

export const MotorControlTab: Component<MotorControlTabProps> = (props) => {
  return (
    <div class="motor-grid">
      <For each={MOTOR_NAMES}>
        {motorName => 
          <SliderCard
            tag='MOTOR'
            name={motorName}
            onChange={value => 
              props.motion.setMotorValue(motorName, value)
            }
            onStop={() => props.motion.stopMotor(motorName)}
          />
        }
      </For>
    </div>
  );
};
