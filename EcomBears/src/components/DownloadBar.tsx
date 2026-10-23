type Props = {
  count: number;
  disabled: boolean;
  onDownload: () => void;
  onStartOver: () => void;
};

export default function DownloadBar({ count, disabled, onDownload, onStartOver }: Props) {
  return (
    <div className="download-bar">
      <div className="download-info">
        <strong>{count} label{count === 1 ? '' : 's'} ready</strong>
        <span className="muted">4 × 6 inch, one label per page</span>
      </div>
      <div className="download-actions">
        <button className="btn-ghost" onClick={onStartOver} disabled={disabled}>
          Start over
        </button>
        <button className="btn-primary" onClick={onDownload} disabled={disabled || count === 0}>
          Download PDF
        </button>
      </div>
    </div>
  );
}
