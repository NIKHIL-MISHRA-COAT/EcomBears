import { useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Crop } from '../config/platforms';
import { scaledCopy } from '../lib/images';

type Props = {
  source: HTMLCanvasElement;
  initial: Crop;
  info: string;
  allowPage: boolean;
  onSaveAll: (c: Crop) => void;
  onApplyPage: (c: Crop) => void;
  onClose: () => void;
};

type Drag = {
  mode: 'move' | 'resize' | 'draw';
  handle?: string;
  start: { x: number; y: number };
  c: Crop;
  active?: boolean;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function normalize(c: Crop): Crop {
  const w = Math.min(1, Math.max(0.02, c.w));
  const h = Math.min(1, Math.max(0.02, c.h));
  return { x: Math.min(1 - w, Math.max(0, c.x)), y: Math.min(1 - h, Math.max(0, c.y)), w, h };
}

export default function CropEditor({ source, initial, info, allowPage, onSaveAll, onApplyPage, onClose }: Props) {
  const [crop, setCrop] = useState<Crop>(() => normalize(initial));
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const img = useMemo(() => scaledCopy(source, Math.min(1100, source.width)), [source]);

  const frac = (e: PointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const p = frac(e);
    const target = e.target as HTMLElement;
    const handle = target.dataset.handle;
    if (handle) drag.current = { mode: 'resize', handle, start: p, c: crop };
    else if (target.dataset.role === 'box') drag.current = { mode: 'move', start: p, c: crop };
    else drag.current = { mode: 'draw', start: p, c: crop };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = frac(e);
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;

    if (d.mode === 'draw') {
      // A click outside the box must not wipe it: only draw once the pointer really moves
      if (!d.active) {
        if (Math.abs(dx) < 0.008 && Math.abs(dy) < 0.008) return;
        d.active = true;
      }
      setCrop(normalize({ x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(dx), h: Math.abs(dy) }));
    } else if (d.mode === 'move') {
      setCrop(normalize({ ...d.c, x: d.c.x + dx, y: d.c.y + dy }));
    } else {
      let l = d.c.x, t = d.c.y, r = d.c.x + d.c.w, b = d.c.y + d.c.h;
      const hd = d.handle!;
      if (hd.includes('w')) l = clamp01(l + dx);
      if (hd.includes('e')) r = clamp01(r + dx);
      if (hd.includes('n')) t = clamp01(t + dy);
      if (hd.includes('s')) b = clamp01(b + dy);
      // Edges may cross; the box flips instead of collapsing
      setCrop(normalize({ x: Math.min(l, r), y: Math.min(t, b), w: Math.abs(r - l), h: Math.abs(b - t) }));
    }
  };

  const onUp = () => { drag.current = null; };

  const setField = (k: keyof Crop, value: number) => {
    setCrop(normalize({ ...crop, [k]: (Number.isFinite(value) ? value : 0) / 100 }));
  };

  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const LABELS: Record<keyof Crop, string> = { x: 'Left %', y: 'Top %', w: 'Width %', h: 'Height %' };

  return (
    <div className="crop-editor">
      <div className="muted">{info}</div>

      <div
        className="crop-stage"
        ref={stageRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img src={img} alt="Original page" draggable={false} />
        <div
          className="crop-box"
          data-role="box"
          style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
        >
          {HANDLES.map(d => <i key={d} className={`grip grip-${d}`} data-handle={d} />)}
        </div>
      </div>

      <div className="crop-fields">
        {(['x', 'y', 'w', 'h'] as const).map(k => (
          <label key={k}>
            {LABELS[k]}
            <input
              type="number"
              step="0.1"
              value={(crop[k] * 100).toFixed(1)}
              onChange={e => setField(k, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <p className="muted">
        Drag the box, pull a handle, or draw a new box anywhere on the page. Output keeps the exact size of this box.
      </p>

      <div className="crop-actions">
        <button className="btn-primary" onClick={() => onSaveAll(crop)}>Save for all labels</button>
        {allowPage && <button className="btn-secondary" onClick={() => onApplyPage(crop)}>Apply to this label only</button>}
        <button className="btn-ghost" onClick={onClose}>Back to result</button>
      </div>
    </div>
  );
}
