import { useEffect } from 'react';

export type LabelItem = {
  id: string;
  source: string;   // original PDF name
  page: number;     // page number inside that PDF
  preview: string;  // medium image for the big view
  thumb: string;    // small image for the strip
};

type Props = {
  labels: LabelItem[];
  index: number;
  onIndex: (i: number) => void;
  onRemove: (id: string) => void;
};

export default function ReviewStep({ labels, index, onIndex, onRemove }: Props) {
  const total = labels.length;
  const label = labels[index];

  // Left and right arrow keys move between labels (ignored while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
      if (e.key === 'ArrowRight') onIndex(Math.min(total - 1, index + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, total, onIndex]);

  if (!label) return null;

  return (
    <section className="card review" aria-label="Check your labels">
      <div className="review-head">
        <div>
          <h2>Check your labels</h2>
          <p className="muted">
            Label {index + 1} of {total} · {label.source}, page {label.page}
          </p>
        </div>
        <button className="btn-ghost danger" onClick={() => onRemove(label.id)}>
          Remove this label
        </button>
      </div>

      <div className="review-stage">
        <button
          className="arrow"
          onClick={() => onIndex(index - 1)}
          disabled={index === 0}
          aria-label="Previous label"
        >
          ‹
        </button>

        <div className="label-frame">
          <img src={label.preview} alt={`Label ${index + 1}`} />
        </div>

        <button
          className="arrow"
          onClick={() => onIndex(index + 1)}
          disabled={index === total - 1}
          aria-label="Next label"
        >
          ›
        </button>
      </div>

      <p className="hint">Tip: use the ← → arrow keys to move between labels.</p>

      <div className="thumbs" role="list">
        {labels.map((l, i) => (
          <button
            key={l.id}
            role="listitem"
            className={`thumb${i === index ? ' active' : ''}`}
            onClick={() => onIndex(i)}
            aria-label={`Go to label ${i + 1}`}
            aria-current={i === index}
          >
            <img src={l.thumb} alt="" />
          </button>
        ))}
      </div>
    </section>
  );
}
