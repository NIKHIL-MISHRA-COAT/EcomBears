import { FACTORY_OPTIONS, PLATFORMS, type Crop, type Options, type PageMode, type PlatformId } from '../config/platforms';

export type Profile = {
  options: Options;
  savedOptions: Options | null;   // "Save as default" for this platform
  pages: PageMode;
  custom: string;
  crop: Crop | null;
  useSaved: boolean;
  learned: (Crop & { n: number }) | null;
};

export type Store = {
  platform: PlatformId;
  autoCrop: boolean;
  sortOn: boolean;
  sortBy: 'sku' | 'courier';
  sortDir: 'asc' | 'desc';
  profiles: Record<PlatformId, Profile>;
};

const KEY = 'labelCropper.react.v1';

export function initialProfile(id: PlatformId): Profile {
  const cfg = PLATFORMS.find(p => p.id === id)!;
  return {
    options: { ...FACTORY_OPTIONS, ...cfg.options },
    savedOptions: null,
    pages: cfg.pages,
    custom: '',
    crop: cfg.crop ?? null,
    useSaved: !!(cfg.useSaved && cfg.crop),
    learned: null,
  };
}

export function defaultStore(): Store {
  const profiles = {} as Record<PlatformId, Profile>;
  for (const p of PLATFORMS) profiles[p.id] = initialProfile(p.id);
  return { platform: 'auto', autoCrop: true, sortOn: false, sortBy: 'sku', sortDir: 'asc', profiles };
}

export function loadStore(): Store {
  const base = defaultStore();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Store>;
    return {
      ...base,
      ...saved,
      profiles: { ...base.profiles, ...(saved.profiles ?? {}) } as Record<PlatformId, Profile>,
    };
  } catch {
    return base;
  }
}

export function saveStore(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: settings last for this visit only */
  }
}
