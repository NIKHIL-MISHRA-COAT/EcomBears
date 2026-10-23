import Dropzone from './Dropzone';

export type FileItem = {
  id: number;
  name: string;
  state: 'waiting' | 'working' | 'done' | 'error';
  detail: string;
};

type Props = { files: FileItem[]; busy: boolean; onFiles: (files: File[]) => void };

const STATE_ICON: Record<FileItem['state'], string> = {
  waiting: '⏳',
  working: '⟳',
  done: '✓',
  error: '!',
};

export default function UploadStep({ files, busy, onFiles }: Props) {
  return (
    <section className="card">
      <Dropzone onFiles={onFiles} disabled={busy} />

      {files.length > 0 && (
        <ul className="file-list" aria-label="Uploaded files">
          {files.map(f => (
            <li key={f.id} className={`file-row ${f.state}`}>
              <span className="file-icon" aria-hidden>{STATE_ICON[f.state]}</span>
              <span className="file-name" title={f.name}>{f.name}</span>
              <span className="file-detail">{f.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
