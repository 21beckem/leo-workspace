import { Component, createSignal, onCleanup } from 'solid-js';

interface NumericDragProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number; // rounding step
}

export const NumericDrag: Component<NumericDragProps> = (props) => {
  let el: HTMLDivElement | undefined;
  let startY = 0;
  let startValue = 0;
  const [dragging, setDragging] = createSignal(false);

  const step = props.step ?? 0.001;
  const clamp = (v: number) => {
    let r = v;
    if (props.min !== undefined) r = Math.max(props.min, r);
    if (props.max !== undefined) r = Math.min(props.max, r);
    // quantize
    const q = Math.round(r / step) * step;
    return Number(q.toFixed(6));
  };

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    startY = e.clientY;
    startValue = props.value;
    setDragging(true);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragging()) return;
    const dy = e.clientY - startY; // positive downward
    const sensitivity = 0.002; // value change per pixel (negative because up increases)
    const newVal = clamp(startValue - dy * sensitivity);
    props.onChange(newVal);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!dragging()) return;
    setDragging(false);
    try { el?.releasePointerCapture(e.pointerId); } catch {}
  };

  onCleanup(() => {
    if (el) {
      try { el.releasePointerCapture?.(0 as any); } catch {}
    }
  });

  return (
    <div
      ref={el}
      class="numeric-drag"
      style={{
        'width': '100%',
        'display': 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        'padding': '8px 10px',
        'border': '1px solid var(--border)',
        'border-radius': '6px',
        'background': 'var(--surface2)',
        'user-select': 'none',
        'touch-action': 'none'
      }}
      onPointerDown={(e) => handlePointerDown(e as unknown as PointerEvent)}
      onPointerMove={(e) => handlePointerMove(e as unknown as PointerEvent)}
      onPointerUp={(e) => handlePointerUp(e as unknown as PointerEvent)}
      onPointerCancel={(e) => handlePointerUp(e as unknown as PointerEvent)}
    >
      <div style={{ 'font-size': '13px', 'color': 'var(--text-dim)' }}>
        Drag to adjust
      </div>
      <div style={{ 'font-family': 'inherit', 'font-weight': 'bold' }}>{props.value.toFixed(3)}</div>
    </div>
  );
};
