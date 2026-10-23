import { useEffect, useState, type ReactNode } from 'react';
import {
  FONTS, PLATFORMS, RIBBON_SECTIONS,
  type Options, type OutSize, type PageMode, type PlatformId, type SkuMode,
} from '../config/platforms';
import type { Profile, Store } from '../lib/settings';

export type RibbonApi = {
  setPlatform(p: PlatformId): void;
  patchStore(patch: Partial<Store>, recrop?: boolean): void;
  patchOptions(patch: Partial<Options>): void;
  patchProfile(patch: Partial<Profile>, mode: 'recrop' | 'repaint' | 'none'): void;
  start(): void;
  openEditor(): void;
  clearSaved(): void;
  forgetLearned(): void;
  saveDefault(): void;
  resetDefault(): void;
  exportPdf(): void;
  exportPng(): void;
};

type Props = {
  store: Store;
  profile: Profile;
  busy: boolean;
  exporting: boolean;
  hasLabels: boolean;
  learnedText: string;
  skuStatus: string;
  api: RibbonApi;
};

// Tabs in the order shown. "Others" uses auto-detect, so it works for any other marketplace.
const TABS: { id: string; label: string; platform: PlatformId }[] = [
  { id: 'amazon', label: 'Amazon', platform: 'amazon' },
  { id: 'meesho', label: 'Meesho', platform: 'meesho' },
  { id: 'flipkart', label: 'Flipkart', platform: 'flipkart' },
  { id: 'myntra', label: 'Myntra', platform: 'myntra' },
  { id: 'snapdeal', label: 'Snapdeal', platform: 'snapdeal' },
  { id: 'others', label: 'Others', platform: 'auto' },
];

// The tab for a platform. Auto has no tab of its own, so it maps to "Others".
const tabFor = (p: PlatformId): string => (p === 'auto' ? 'others' : p);

export default function Ribbon(props: Props) {
  const [expanded, setExpanded] = useState(false);
  // The highlighted tab always follows the platform, so a blocked switch never shows the wrong tab
  const tab = tabFor(props.store.platform);

  const platformId = TABS.find(t => t.id === tab)?.platform ?? 'auto';
  const cfg = PLATFORMS.find(p => p.id === platformId)!;
  const always = cfg.always;
  const allowed = cfg.groups ?? RIBBON_SECTIONS.map(s => s.title);
  const sections = RIBBON_SECTIONS.filter(s => allowed.includes(s.title) && (expanded || always.includes(s.title)));

  const pick = (t: { id: string; platform: PlatformId }) => {
    if (t.platform !== props.store.platform) props.api.setPlatform(t.platform);
  };

  return (
    <div className="ribbon">
      <div className="rb-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`rb-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => pick(t)}
          >
            {t.label}
          </button>
        ))}
        <button className="rb-tab rb-more" onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Fewer options ▴' : 'More options ▾'}
        </button>
      </div>

      <div className="rb-body">
        {sections.map(s => (
          <div key={s.title} className={`rb-section${s.download ? ' rb-download' : ''}`}>
            <div className="rb-title">{s.title}</div>
            <div className="rb-items">
              {s.controls.map(id => <Control key={id} id={id} p={props} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Control({ id, p }: { id: string; p: Props }): ReactNode {
  const { api, store, profile, busy, exporting, hasLabels } = p;
  const o = profile.options;

  switch (id) {
    case 'process':
      return <button className="btn-primary" onClick={api.start} disabled={busy}>Start again</button>;

    case 'sku':
      return (
        <Field label="Text on label">
          <Seg
            value={o.sku}
            choices={[['none', 'None'], ['id', 'SKU ID'], ['desc', 'Description']]}
            onChange={v => api.patchOptions({ sku: v as SkuMode })}
          />
        </Field>
      );

    case 'skuTemplate':
      return (
        <Field label="Text format  ({sku} {desc} {qty})">
          <TextField value={o.skuTemplate} placeholder="{sku}  Qty: {qty}"
            onCommit={v => api.patchOptions({ skuTemplate: v || '{sku}  Qty: {qty}' })} />
        </Field>
      );

    case 'skuFont':
      return (
        <Field label="Font">
          <select className="rb-input" value={o.skuFont}
            onChange={e => api.patchOptions({ skuFont: e.target.value })}>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
      );

    case 'skuPx':
      return (
        <Field label="Size in px (empty = auto)">
          <TextField type="number" value={o.skuPx ? String(o.skuPx) : ''}
            onCommit={v => api.patchOptions({ skuPx: v ? Number(v) : null })} />
        </Field>
      );

    case 'skuSizeSeg':
      return (
        <Field label="Text size">
          <Seg value={String(o.skuSize)}
            choices={[['0.8', 'Small'], ['1', 'Medium'], ['1.4', 'Large']]}
            onChange={v => api.patchOptions({ skuSize: parseFloat(v) })} />
        </Field>
      );

    case 'skuBorder':
      return <Toggle label="Black border" on={o.skuBorder} onChange={v => api.patchOptions({ skuBorder: v })} />;

    case 'skuStatus':
      return <p className="rb-info">{p.skuStatus}</p>;

    case 'sortToggle':
      return <Toggle label="Sort labels" on={store.sortOn} onChange={v => api.patchStore({ sortOn: v })} />;

    case 'sortBy':
      return store.sortOn ? (
        <Field label="Sort by">
          <Seg value={store.sortBy} choices={[['sku', 'SKU number'], ['courier', 'Courier']]}
            onChange={v => api.patchStore({ sortBy: v as Store['sortBy'] })} />
        </Field>
      ) : null;

    case 'sortDir':
      return store.sortOn ? (
        <Field label="Order">
          <select className="rb-input" value={store.sortDir}
            onChange={e => api.patchStore({ sortDir: e.target.value as Store['sortDir'] })}>
            <option value="asc">Low → High / A → Z</option>
            <option value="desc">High → Low / Z → A</option>
          </select>
        </Field>
      ) : null;

    case 'outSize':
      return (
        <Field label="Output size">
          <select className="rb-input" value={o.out}
            onChange={e => api.patchOptions({ out: e.target.value as OutSize })}>
            <option value="orig">Original (as cropped)</option>
            <option value="4x6">4 × 6 in</option>
            <option value="100x150">100 × 150 mm</option>
            <option value="a6">A6</option>
          </select>
        </Field>
      );

    case 'pages':
      return (
        <Field label="Pages">
          <select className="rb-input" value={profile.pages}
            onChange={e => api.patchProfile({ pages: e.target.value as PageMode }, 'recrop')}>
            <option value="all">Every page</option>
            <option value="odd">Odd pages</option>
            <option value="even">Even pages</option>
            <option value="custom">Custom list</option>
          </select>
        </Field>
      );

    case 'pagesCustom':
      return profile.pages === 'custom' ? (
        <Field label="Custom pages (e.g. 1,3,5-8)">
          <TextField value={profile.custom} placeholder="1,3,5-8"
            onCommit={v => api.patchProfile({ custom: v }, 'recrop')} />
        </Field>
      ) : null;

    case 'autoCrop':
      return <Toggle label="Auto crop" on={store.autoCrop} onChange={v => api.patchStore({ autoCrop: v }, true)} />;

    case 'openEditor':
      return <button className="btn-ghost" onClick={() => api.openEditor()}>✂ Crop editor</button>;

    case 'useSaved':
      return (
        <Toggle
          label="Use saved crop"
          on={profile.useSaved && !!profile.crop}
          onChange={v => (v && !profile.crop ? api.openEditor() : api.patchProfile({ useSaved: v }, 'recrop'))}
        />
      );

    case 'editSaved':
      return <button className="btn-ghost" onClick={() => api.openEditor()}>Edit saved crop</button>;

    case 'clearSaved':
      return <button className="btn-ghost" onClick={() => api.clearSaved()}>Clear saved crop</button>;

    case 'savedInfo':
      return <p className="rb-info">{savedText(profile)}</p>;

    case 'learnedInfo':
      return <p className="rb-info">{p.learnedText}</p>;

    case 'forgetLearned':
      return <button className="btn-ghost" onClick={() => api.forgetLearned()}>Forget learned size</button>;

    case 'setDefault':
      return <button className="btn-ghost" onClick={() => api.saveDefault()}>Save as default for this platform</button>;

    case 'resetDefault':
      return <button className="btn-ghost" onClick={() => api.resetDefault()}>Reset to saved default</button>;

    case 'exportPdf':
      return (
        <button className="btn-primary" disabled={!hasLabels || exporting} onClick={() => api.exportPdf()}>
          {exporting ? 'Working…' : 'Download PDF'}
        </button>
      );

    case 'exportPng':
      return (
        <button className="btn-ghost" disabled={!hasLabels || exporting} onClick={() => api.exportPng()}>
          Download PNG
        </button>
      );

    default:
      return null;
  }
}

function savedText(profile: Profile): string {
  const c = profile.crop;
  return c
    ? `Saved: left ${(c.x * 100).toFixed(1)}%, top ${(c.y * 100).toFixed(1)}%, width ${(c.w * 100).toFixed(1)}%, height ${(c.h * 100).toFixed(1)}%`
    : 'No saved crop yet. Open the crop editor to set one.';
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rb-field">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Seg({ value, choices, onChange }: { value: string; choices: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="seg" role="group">
      {choices.map(([v, text]) => (
        <button
          key={v}
          type="button"
          className={`seg-opt${value === v ? ' on' : ''}`}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="rb-check">
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// Applies the value when the user leaves the field or presses Enter
function TextField({
  value, onCommit, placeholder, type = 'text',
}: { value: string; onCommit: (v: string) => void; placeholder?: string; type?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <input
      className="rb-input"
      type={type}
      value={draft}
      placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onCommit(draft.trim())}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}