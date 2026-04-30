import { Component, Accessor } from 'solid-js';
import { MotorName } from '../stores';
import { MotorSlider } from './MotorSlider';

interface MotorCardProps {
  motorName: MotorName;
  value: Accessor<number>;
  onChange: (value: number, send?: boolean) => void;
  onStop: () => void;
}

export const MotorCard: Component<MotorCardProps> = (props) => {
  const getCardClass = () => {
    const v = props.value();
    const base = 'motor-card';
    if (v > 0) return `${base} fwd`;
    if (v < 0) return `${base} rev`;
    return base;
  };

  const getReadout = () => {
    const v = props.value();
    if (v === 0) return '---';
    const pct = Math.round(Math.abs(v) * 100);
    const dir = v > 0 ? 'FWD' : 'REV';
    return `${pct}%  ${dir}`;
  };

  return (
    <div class={getCardClass()}>
      <div class="motor-tag">MOTOR</div>
      <div class="motor-letter">{props.motorName}</div>

      <MotorSlider value={props.value} onChange={props.onChange} />

      <div class="motor-readout">{getReadout()}</div>
      <button class="btn-motor-stop" onClick={props.onStop}>
        ■ STOP
      </button>
    </div>
  );
};
