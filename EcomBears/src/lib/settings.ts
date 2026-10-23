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

// Settings are not stored in the browser. Every page load starts from the values in
// src/config/platforms.ts, and changes last only until the page is reloaded.
export function loadStore(): Store {
  return defaultStore();
}

// No-op: nothing is written to localStorage.
export function saveStore(_s: Store) {}