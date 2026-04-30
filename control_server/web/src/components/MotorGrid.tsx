import { Component, For, Accessor } from 'solid-js';
import { Motor, MotorName, MOTOR_NAMES } from '../stores';
import { MotorCard } from './MotorCard';

interface MotorGridProps {
  motors: Accessor<Record<MotorName, Motor>>;
  onMotorChange: (motor: MotorName, value: number, send?: boolean) => void;
  onMotorStop: (motor: MotorName) => void;
}

export const MotorGrid: Component<MotorGridProps> = (props) => {
  return (
    <div class="motor-grid">
      <For each={MOTOR_NAMES}>
        {(motorName) => {
          const motorData = () => props.motors()[motorName];
          return (
            <MotorCard
              motorName={motorName}
              value={() => motorData().value}
              onChange={(value, send) =>
                props.onMotorChange(motorName, value, send)
              }
              onStop={() => props.onMotorStop(motorName)}
            />
          );
        }}
      </For>
    </div>
  );
};
