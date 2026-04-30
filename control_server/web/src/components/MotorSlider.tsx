import { Component, createEffect, createSignal } from 'solid-js';

const SNAP_ZONE = 0.04;
const TRACK_H = 188;

interface MotorSliderProps {
  value: () => number;
  onChange: (value: number, send?: boolean) => void;
}

export const MotorSlider: Component<MotorSliderProps> = (props) => {
  let zoneRef: HTMLDivElement | undefined;
  let railRef: HTMLDivElement | undefined;
  let fillRef: HTMLDivElement | undefined;
  let thumbRef: HTMLDivElement | undefined;

  const [isDragging, setIsDragging] = createSignal(false);

  const valueFromEvent = (e: PointerEvent): number => {
    if (!railRef) return 0;
    const rect = railRef.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const clamp = Math.max(0, Math.min(rect.height, relY));
    let v = 1 - (clamp / rect.height) * 2; // 1 at top, -1 at bottom
    if (Math.abs(v) < SNAP_ZONE) v = 0;
    return v;
  };

  const updateVisuals = () => {
    if (!thumbRef || !fillRef) return;

    const v = props.value();
    const thumbTopPx = ((1 - v) / 2) * TRACK_H;
    thumbRef.style.top = `${thumbTopPx}px`;

    const centerPx = TRACK_H / 2;
    if (v > 0) {
      const fillH = centerPx - thumbTopPx;
      fillRef.style.top = `${thumbTopPx}px`;
      fillRef.style.height = `${fillH}px`;
      fillRef.style.background = 'var(--fwd)';
    } else if (v < 0) {
      const fillH = thumbTopPx - centerPx;
      fillRef.style.top = `${centerPx}px`;
      fillRef.style.height = `${fillH}px`;
      fillRef.style.background = 'var(--rev)';
    } else {
      fillRef.style.height = '0';
    }
  };

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    if (!zoneRef) return;
    zoneRef.setPointerCapture(e.pointerId);
    setIsDragging(true);
    zoneRef.classList.add('dragging');
    props.onChange(valueFromEvent(e), true);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging()) return;
    props.onChange(valueFromEvent(e), true);
  };

  const handlePointerEnd = () => {
    if (!isDragging()) return;
    setIsDragging(false);
    if (zoneRef) zoneRef.classList.remove('dragging');
    props.onChange(0, false);
  };

  createEffect(() => {
    props.value();
    updateVisuals();
  });

  return (
    <div
      ref={zoneRef}
      class="slider-zone"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div ref={railRef} class="slider-rail">
        <div ref={fillRef} class="slider-fill"></div>
        <div ref={thumbRef} class="slider-thumb"></div>
      </div>
    </div>
  );
};
