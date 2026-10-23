import { useRef, useState, type DragEvent } from 'react';

type Props = { onFiles: (files: File[]) => void; disabled?: boolean };

export default function Dropzone({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (list: FileList | null) => {
    if (!list) return;
    const pdfs = Array.from(list).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length) onFiles(pdfs);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) accept(e.dataTransfer.files);
  };

  return (
    <div
      className={`dropzone${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="dropzone-icon" aria-hidden>📄</div>
      <p className="dropzone-title">Drop your label PDFs here</p>
      <p className="dropzone-sub">Amazon, Flipkart, Meesho, Myntra or Snapdeal</p>
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Choose PDF files
      </button>
      <p className="dropzone-privacy">🔒 Your files are processed on your computer and never uploaded.</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        disabled={disabled}
        onChange={e => { accept(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
