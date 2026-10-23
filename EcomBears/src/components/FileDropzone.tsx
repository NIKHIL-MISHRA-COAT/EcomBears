import { useRef, useState, type DragEvent } from 'react';

type Props = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  title?: string;
};

// Drag-and-drop or click to choose PDFs. Only PDFs are passed on.
export default function FileDropzone({ onFiles, disabled = false, title = 'Drop label PDFs here' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (list: FileList | null) => {
    if (!list) return;
    const pdfs = Array.from(list).filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
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
      <p>{title}</p>
      <button type="button" className="btn-secondary" disabled={disabled} onClick={() => inputRef.current?.click()}>
        Choose PDFs
      </button>
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
