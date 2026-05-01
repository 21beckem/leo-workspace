import { Component, createSignal } from 'solid-js';
import { MotorSlider } from './MotorSlider';

interface SliderCardProps {
  tag: string;
  name: string;
  onChange: (value: number) => void;
  onStop: () => void;
}

export const SliderCard: Component<SliderCardProps> = (props) => {
  const [value, setValue] = createSignal(0);
  const getCardClass = () => {
    const v = value();
    const base = 'control-card';
    if (v > 0) return `${base} fwd`;
    if (v < 0) return `${base} rev`;
    return base;
  };

  const getReadout = () => {
    const v = value();
    if (v === 0) return '---';
    const pct = Math.round(Math.abs(v) * 100);
    const dir = v > 0 ? 'FWD' : 'REV';
    return `${pct}%  ${dir}`;
  };

  const onChange = (val: number) => {
    setValue(val);
    props.onChange(val);
  };

  return (
    <div class={getCardClass()}>
      <div class="control-tag">{props.tag}</div>
      <div class="control-label">{props.name}</div>

      <MotorSlider value={value} onChange={onChange} />

      <div class="control-readout">{getReadout()}</div>
      <button class="btn-control-stop" onClick={props.onStop}>
        ■ STOP
      </button>
    </div>
  );
};
