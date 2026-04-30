import { Component, For, Accessor } from 'solid-js';
import { Motor, MotorName, ROBOT_JOINTS, JointType } from '../stores';
import { MotorCard } from './MotorCard';

interface JointGridProps {
  motors: Accessor<Record<MotorName, Motor>>;
  onMotorChange: (motor: MotorName, value: number, send?: boolean) => void;
  onMotorStop: (motor: MotorName) => void;
}

export const JointGrid: Component<JointGridProps> = (props) => {
  return (
    <div class="motor-grid">
      <For each={ROBOT_JOINTS}>
        {(joint) => {
          return (
            <MotorCard
              motorName={joint.name as MotorName}
              value={() => 0}
              onChange={(value, send) => {
                if (joint.type === JointType.ADDITIVE) {
                  props.onMotorChange(joint.motors[0] as MotorName, value, send);
                  props.onMotorChange(joint.motors[1] as MotorName, value, send);
                } else {
                  props.onMotorChange(joint.motors[0] as MotorName, value, send);
                  props.onMotorChange(joint.motors[1] as MotorName, -value, send);
                }
              }}
              onStop={() => {
                props.onMotorStop(joint.motors[0] as MotorName);
                props.onMotorStop(joint.motors[1] as MotorName);
              }}
            />
          );
        }}
      </For>
    </div>
  );
};
