import { Component, For } from 'solid-js';
import { MOTOR_NAMES, createMotionControlStore } from '../stores';
import { SliderCard } from '../components/SliderCard';

interface MotorControlTabProps {
  motionControl: ReturnType<typeof createMotionControlStore>;
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
              props.motionControl.setMotorValue(motorName, value)
            }
            onStop={() => props.motionControl.stopMotor(motorName)}
          />
        }
      </For>
    </div>
  );
};
