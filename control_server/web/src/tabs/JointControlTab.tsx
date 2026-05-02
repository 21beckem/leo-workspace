import { Component, For } from 'solid-js';
import { ROBOT_JOINTS, JointType, createMotionStore } from '../stores';
import { SliderCard } from '../components/SliderCard';

interface JointControlTabProps {
  motion: ReturnType<typeof createMotionStore>;
}

export const JointControlTab: Component<JointControlTabProps> = (props) => {
  return (
    <div class="motor-grid">
      <For each={ROBOT_JOINTS}>
        {joint =>
					<div style={{ 'position': 'relative' }}>
						<SliderCard
              tag=''
              name={joint.name}
              onChange={value => {
                if (joint.type === JointType.ADDITIVE) {
                  props.motion.setMotorValue(joint.motors[0], value);
                  props.motion.setMotorValue(joint.motors[1], value);
                } else {
                  props.motion.setMotorValue(joint.motors[0], value);
                  props.motion.setMotorValue(joint.motors[1], -value);
                }
              }}
              onStop={() => {
                props.motion.stopMotor(joint.motors[0]);
                props.motion.stopMotor(joint.motors[1]);
              }}
            />
						<div style={{
							position: 'absolute',
							top: '10px',
							left: '50%',
              transform: 'translateX(-50%)',
						}}>
							{props.motion.getPots()[joint.name].toFixed(5)}
						</div>
					</div>
        }
      </For>
    </div>
  );
};
