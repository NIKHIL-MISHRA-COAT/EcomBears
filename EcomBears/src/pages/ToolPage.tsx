import { useEffect, useMemo, useRef, useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import FileDropzone from '../components/FileDropzone';
import Toast, { type ToastState } from '../components/Toast';
import Ribbon, { type RibbonApi } from '../components/Ribbon';
import CropEditor from '../components/CropEditor';
import { PLATFORMS, type Crop, type Options, type PlatformId } from '../config/platforms';
import { loadStore, saveStore, type Profile, type Store } from '../lib/settings';
import { renderPage, RENDER_SCALE } from '../lib/pdfLoader';
import { detectLabel } from '../lib/detect';
import { exportSizedPdf, exportOriginalPdf, exportPngZip, type ExportLabel } from '../lib/export';
import {
  fracToRect, rectToFrac, processFiles, repaint, sortLabels,
  type FileEntry, type Label,
} from '../lib/processing';

type Editor = { source: HTMLCanvasElement; crop: Crop; info: string; allowPage: boolean } | null;

export default function ToolPage() {
  const [store, setStore] = useState<Store>(() => {
    const s = loadStore();
    // /tool?platform=amazon opens that platform
    const p = new URLSearchParams(window.location.search).get('platform');
    if (p && PLATFORMS.some(x => x.id === p)) s.platform = p as PlatformId;
    return s;
  });
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editor, setEditor] = useState<Editor>(null);

  const busyRef = useRef(false);
  const nextId = useRef(1);

  const profile = store.profiles[store.platform];
  const view = useMemo(() => sortLabels(labels, store), [labels, store]);
  const idx = Math.min(current, Math.max(0, view.length - 1));
  const label = view[idx];

  useEffect(() => { saveStore(store); }, [store]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Left and right arrows move between labels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editor || !view.length) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') setCurrent(c => Math.max(0, c - 1));
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(view.length - 1, c + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, view.length]);

  /* ---------- processing ---------- */

  const run = async (entries: FileEntry[], st: Store) => {
    if (!entries.length) {
      setLabels([]);
      setCurrent(0);
      return;
    }
    if (busyRef.current) {
      setToast({ kind: 'info', text: 'Still working on the last change. Try again in a moment.' });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setProgress(0);
    try {
      const result = await processFiles(
        entries,
        st,
        (id, patch) => setFiles(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f))),
        setProgress,
      );
      setLabels(result.labels);
      setCurrent(0);
      setStore(s => ({ ...s, profiles: { ...s.profiles, [st.platform]: result.profile } }));
      if (!result.labels.length) {
        setToast({ kind: 'error', text: 'No labels found. Check the page selection or try another PDF.' });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress(0);
    }
  };

  const addFiles = (picked: File[]) => {
    if (busyRef.current) {
      setToast({ kind: 'info', text: 'Please wait until the current files are done.' });
      return;
    }
    const entries: FileEntry[] = picked.map(file => ({
      id: nextId.current++,
      file,
      state: 'waiting',
      detail: 'Waiting…',
    }));
    const all = [...files, ...entries];
    setFiles(all);
    void run(all, store);
  };

  const removeFile = (id: number) => {
    const nf = files.filter(f => f.id !== id);
    const next = labels.filter(l => l.fileId !== id);
    setFiles(nf);
    setLabels(next);
    setCurrent(c => Math.min(c, Math.max(0, next.length - 1)));
  };

  /* ---------- settings ---------- */

  const patchStore = (patch: Partial<Store>, recrop = false) => {
    const ns: Store = { ...store, ...patch };
    setStore(ns);
    if (recrop) void run(files, ns);
  };

  const patchProfile = (patch: Partial<Profile>, mode: 'recrop' | 'repaint' | 'none') => {
    const np: Profile = { ...profile, ...patch };
    const ns: Store = { ...store, profiles: { ...store.profiles, [store.platform]: np } };
    setStore(ns);
    if (mode === 'recrop') void run(files, ns);
    else if (mode === 'repaint') setLabels(prev => prev.map(l => repaint(l, np)));
  };

  const patchOptions = (patch: Partial<Options>) => {
    patchProfile({ options: { ...profile.options, ...patch } }, 'repaint');
  };

  // Switching tabs starts a fresh batch: uploaded files, labels and any open editor are removed
  const setPlatform = (p: PlatformId) => {
    if (p === store.platform) return;
    if (busyRef.current) {
      setToast({ kind: 'info', text: 'Please wait until the current files are done.' });
      return;
    }
    if (files.length) setToast({ kind: 'info', text: 'Files cleared for the new platform' });
    setFiles([]);
    setLabels([]);
    setCurrent(0);
    setEditor(null);
    setStore({ ...store, platform: p });
  };

  const saveDefault = () => {
    patchProfile({ savedOptions: profile.options }, 'none');
    setToast({ kind: 'ok', text: `Saved as default for ${PLATFORMS.find(p => p.id === store.platform)!.name}` });
  };

  const resetDefault = () => {
    if (!profile.savedOptions) {
      setToast({ kind: 'info', text: 'No saved default yet' });
      return;
    }
    patchProfile({ options: profile.savedOptions }, 'repaint');
  };

  const clearSaved = () => {
    patchProfile({ crop: null, useSaved: false }, 'recrop');
    setToast({ kind: 'info', text: 'Saved crop cleared' });
  };

  const forgetLearned = () => {
    patchProfile({ learned: null }, 'none');
    setToast({ kind: 'info', text: 'Learned size cleared' });
  };

  /* ---------- label actions ---------- */

  const replaceLabel = (next: Label) => {
    setLabels(prev => prev.map(x => (x.id === next.id ? repaint(next, profile) : x)));
  };

  const redetect = () => {
    if (!label) return;
    const d = detectLabel(label.sourceCanvas, store.platform, label.textItems);
    replaceLabel({ ...label, cropRect: { x: d.x, y: d.y, w: d.w, h: d.h } });
  };

  const fullPage = () => {
    if (!label) return;
    replaceLabel({ ...label, cropRect: { x: 0, y: 0, w: label.sourceCanvas.width, h: label.sourceCanvas.height } });
  };

  const rotate = () => {
    if (!label) return;
    const src = label.sourceCanvas;
    const rot = document.createElement('canvas');
    rot.width = src.height;
    rot.height = src.width;
    const ctx = rot.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rot.width, rot.height);
    ctx.translate(rot.width / 2, rot.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    const d = detectLabel(rot, store.platform, null);
    replaceLabel({
      ...label,
      sourceCanvas: rot,
      textItems: [],
      rotated: true, // can no longer be cut from the source PDF as vector
      cropRect: { x: d.x, y: d.y, w: d.w, h: d.h },
    });
    setToast({ kind: 'info', text: 'Rotated 90°' });
  };

  /* ---------- crop editor ---------- */

  const openEditor = async () => {
    if (label) {
      setEditor({
        source: label.sourceCanvas,
        crop: rectToFrac(label.cropRect, label.sourceCanvas),
        info: `${label.fileName}, page ${label.pageNum}`,
        allowPage: true,
      });
      return;
    }
    if (!files.length) {
      setToast({ kind: 'info', text: 'Add a PDF first' });
      return;
    }
    try {
      const src = await renderPage(files[0].file, 1, 1.5);
      setEditor({
        source: src,
        crop: profile.crop ?? { x: 0.03, y: 0.03, w: 0.94, h: 0.45 },
        info: `${files[0].file.name}, page 1`,
        allowPage: false,
      });
    } catch {
      setToast({ kind: 'error', text: 'Could not read the PDF for the editor' });
    }
  };

  const saveAllCrop = (c: Crop) => {
    setEditor(null);
    patchProfile({ crop: c, useSaved: true }, 'recrop');
    setToast({ kind: 'ok', text: 'Crop saved and applied to all labels' });
  };

  const applyPageCrop = (c: Crop) => {
    if (!label) return;
    setEditor(null);
    replaceLabel({ ...label, cropRect: fracToRect(c, label.sourceCanvas) });
    setToast({ kind: 'ok', text: 'Crop applied to this label' });
  };

  /* ---------- downloads ---------- */

  const exportPdf = async () => {
    if (!view.length) return;
    const o = profile.options;
    setExporting(true);
    try {
      if (o.out === 'orig') {
        const list: ExportLabel[] = view.map(l => ({
          fileId: l.fileId,
          fileName: l.fileName,
          pageNum: l.pageNum,
          cropRect: l.cropRect,
          sourceCanvas: l.sourceCanvas,
          canvas: l.canvas,
          rotated: l.rotated,
          hasFooter: l.hasFooter,
        }));
        await exportOriginalPdf(
          list,
          async id => {
            const f = files.find(x => x.id === id);
            if (!f) throw new Error('Source file is missing');
            return f.file.arrayBuffer();
          },
          RENDER_SCALE,
          'labels_original_size.pdf',
        );
      } else {
        exportSizedPdf(view.map(l => l.canvas), o.out, `thermal_labels_${o.out}.pdf`);
      }
      setToast({ kind: 'ok', text: 'PDF downloaded' });
    } catch (err) {
      console.error(err);
      setToast({ kind: 'error', text: 'Download failed: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setExporting(false);
    }
  };

  const exportPng = async () => {
    if (!view.length) return;
    setExporting(true);
    try {
      await exportPngZip(view.map(l => l.canvas), 'label');
    } catch {
      setToast({ kind: 'error', text: 'PNG download failed' });
    } finally {
      setExporting(false);
    }
  };

  /* ---------- derived text ---------- */

  const learnedText = profile.learned && profile.learned.n
    ? `Learned from ${profile.learned.n} label${profile.learned.n > 1 ? 's' : ''}: ${(profile.learned.h * 100).toFixed(1)}% tall, starts ${(profile.learned.y * 100).toFixed(1)}% from the top.`
    : 'Not learned yet. It is learned from the first label detected with high confidence.';

  const skuStatus = useMemo(() => {
    const mode = profile.options.sku;
    if (!labels.length) return '';
    if (mode === 'none') return 'SKU text is off.';
    const field = mode === 'id' ? 'sku' : 'description';
    const found = labels.filter(l => l.skuInfo[field]).length;
    const missing = labels.length - found;
    return `${mode === 'id' ? 'SKU ID' : 'Description'} found on ${found} of ${labels.length} labels.` +
      (missing ? ' The rest have no readable text and print without it.' : '');
  }, [labels, profile.options.sku]);

  const api: RibbonApi = {
    setPlatform,
    patchStore,
    patchOptions,
    patchProfile,
    start: () => void run(files, store),
    openEditor: () => void openEditor(),
    clearSaved,
    forgetLearned,
    saveDefault,
    resetDefault,
    exportPdf: () => void exportPdf(),
    exportPng: () => void exportPng(),
  };

  return (
    <div className="app">
      <SiteHeader />

      <Ribbon
        store={store}
        profile={profile}
        busy={busy}
        exporting={exporting}
        hasLabels={labels.length > 0}
        learnedText={learnedText}
        skuStatus={skuStatus}
        api={api}
      />

      <main className="workspace">
        <aside className="card side">
          <h2>Files</h2>

          <FileDropzone onFiles={addFiles} disabled={busy} />

          {busy && (
            <div className="progress" aria-label="Progress">
              <div style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
          )}

          {files.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>No files yet.</p>
          ) : (
            <ul className="file-list">
              {files.map(f => (
                <li key={f.id} className={`file-row ${f.state}`}>
                  <span className="file-name" title={f.file.name}>{f.file.name}</span>
                  <span className="file-detail">{f.detail}</span>
                  <button className="file-remove" aria-label="Remove file" disabled={busy} onClick={() => removeFile(f.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="muted" style={{ marginTop: 12 }}>Labels: {labels.length}</div>
        </aside>

        <section className="card preview">
          {editor ? (
            <CropEditor
              key={editor.info}
              source={editor.source}
              initial={editor.crop}
              info={editor.info}
              allowPage={editor.allowPage}
              onSaveAll={saveAllCrop}
              onApplyPage={applyPageCrop}
              onClose={() => setEditor(null)}
            />
          ) : !files.length ? (
            <div className="empty">
              <div style={{ fontSize: '2rem' }}>🏷</div>
              <h3>No labels yet</h3>
              <p>Add a PDF to see the labels here.</p>
            </div>
          ) : !label ? (
            <div className="empty">
              <h3>No labels found</h3>
              <p>Check the page selection in Pages, or try another PDF.</p>
            </div>
          ) : (
            <>
              <div className="preview-bar">
                <button className="btn-ghost" onClick={() => setCurrent(Math.max(0, idx - 1))} disabled={idx === 0}>‹ Prev</button>
                <span className="muted">
                  {idx + 1} / {view.length} · {label.fileName} · page {label.pageNum}
                </span>
                <button className="btn-ghost" onClick={() => setCurrent(Math.min(view.length - 1, idx + 1))} disabled={idx === view.length - 1}>Next ›</button>
              </div>

              <div className="label-frame">
                <img src={label.preview} alt={`Label ${idx + 1}`} />
              </div>

              <div className="tool-row">
                <button className="btn-ghost" onClick={redetect}>🔍 Re-detect</button>
                <button className="btn-ghost" onClick={rotate}>↻ Rotate</button>
                <button className="btn-ghost" onClick={fullPage}>⬜ Full page</button>
                <button className="btn-ghost" onClick={() => void openEditor()}>✂ Crop editor</button>
              </div>

              <div className="thumbs">
                {view.map((l, i) => (
                  <button key={l.id} className={`thumb${i === idx ? ' active' : ''}`} onClick={() => setCurrent(i)} aria-label={`Label ${i + 1}`}>
                    <img src={l.thumb} alt="" />
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <Toast toast={toast} />
    </div>
  );
}