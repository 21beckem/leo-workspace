import { Component, For } from 'solid-js';
import { ROBOT_JOINTS, JointType, createMotionControlStore } from '../stores';
import { SliderCard } from '../components/SliderCard';

interface JointControlTabProps {
  motionControl: ReturnType<typeof createMotionControlStore>;
}

export const JointControlTab: Component<JointControlTabProps> = (props) => {
  return (
    <div class="motor-grid">
      <For each={ROBOT_JOINTS}>
        {joint => 
          <SliderCard
            tag='JOINT'
            name={joint.name}
            onChange={value => {
              if (joint.type === JointType.ADDITIVE) {
                props.motionControl.setMotorValue(joint.motors[0], value);
                props.motionControl.setMotorValue(joint.motors[1], value);
              } else {
                props.motionControl.setMotorValue(joint.motors[0], value);
                props.motionControl.setMotorValue(joint.motors[1], -value);
              }
            }}
            onStop={() => {
              props.motionControl.stopMotor(joint.motors[0]);
              props.motionControl.stopMotor(joint.motors[1]);
            }}
          />
        }
      </For>
    </div>
  );
};
