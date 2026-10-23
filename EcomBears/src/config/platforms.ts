// One place for platform defaults and ribbon layout.
// To hide or show an option, edit RIBBON_SECTIONS (controls) or a platform's "always" / "groups" lists.

export type PlatformId = 'auto' | 'amazon' | 'meesho' | 'flipkart' | 'myntra' | 'snapdeal';
export type OutSize = 'orig' | '4x6' | '100x150' | 'a6';
export type PageMode = 'all' | 'odd' | 'even' | 'custom';
export type SkuMode = 'none' | 'id' | 'desc';
export type Crop = { x: number; y: number; w: number; h: number }; // fractions of the page (0–1)

export type Options = {
  sku: SkuMode;
  skuTemplate: string;   // {sku} {desc} {qty}
  skuFont: string;
  skuPx: number | null;  // exact text size in px, null = automatic
  skuSize: number;       // 0.8 small, 1 medium, 1.4 large
  skuBorder: boolean;
  out: OutSize;
};

export const FACTORY_OPTIONS: Options = {
  sku: 'none',
  skuTemplate: '{sku}  Qty: {qty}',
  skuFont: 'Times New Roman',
  skuPx: null,
  skuSize: 1,
  skuBorder: false,
  out: '4x6',
};

export type PlatformConfig = {
  id: PlatformId;
  name: string;
  tagline: string;
  pages: PageMode;
  crop?: Crop;             // default crop for this platform
  useSaved?: boolean;      // use that crop on every page from the start
  options?: Partial<Options>;
  always: string[];        // ribbon sections visible without "More options"
  groups?: string[];       // ribbon sections this tab may show (default: all)
};

export const PLATFORMS: PlatformConfig[] = [
  { id: 'auto', name: 'Auto', tagline: 'Finds the label on any PDF', pages: 'all',
    always: ['Sort', 'Output', 'Download'] },

  // { id: 'amazon', name: 'Amazon', tagline: 'Crops the shipping label and adds SKU text', pages: 'odd',
  //   crop: { x: 0.048, y: 0.032, w: 0.933, h: 0.947 }, useSaved: true,
  //   options: { sku: 'id', skuTemplate: '{sku}  (Qty: {qty})', skuPx: 55, skuSize: 1.4, skuBorder: true },
  //   always: ['Text on label', 'Sort', 'Output', 'Download'],
  //   groups: ['Text on label', 'Sort', 'Output', 'Download'] },

  { id: 'amazon', name: 'Amazon', tagline: 'Crops the shipping label and adds SKU text', pages: 'odd',
    crop: { x: 0.048, y: 0.032, w: 0.933, h: 0.947 }, useSaved: true,
    options: { sku: 'id', skuTemplate: '{sku}  (Qty: {qty})', skuPx: 55, skuSize: 1.4, skuBorder: true },
    always: ['Text on label', 'Sort', 'Output', 'Download']},


  { id: 'meesho', name: 'Meesho', tagline: 'Valmo label above the tax invoice', pages: 'all',
    always: ['Sort', 'Output', 'Download'] },

  { id: 'flipkart', name: 'Flipkart', tagline: 'Main shipment label', pages: 'all',
    crop: { x: 0.294, y: 0.015, w: 0.412, h: 0.444 }, useSaved: true,
    always: ['Sort', 'Output', 'Download'] },
  { id: 'myntra', name: 'Myntra', tagline: 'Learns the size after the first label', pages: 'all',
    always: ['Sort', 'Output', 'Download'] },
  { id: 'snapdeal', name: 'Snapdeal', tagline: 'Learns the size after the first label', pages: 'all',
    always: ['Sort', 'Output', 'Download'] },
];

export type RibbonSection = { title: string; controls: string[]; download?: boolean };

export const RIBBON_SECTIONS: RibbonSection[] = [
  { title: 'Process', controls: ['process'] },
  { title: 'Text on label', controls: ['sku'] },
  
  { title: 'Text edit', controls: [ 'skuTemplate', 'skuFont', 'skuPx', 'skuSizeSeg', 'skuBorder', 'skuStatus'] },
  { title: 'Sort', controls: ['sortToggle', 'sortBy', 'sortDir'] },
  { title: 'Output', controls: ['outSize'] },
  { title: 'Pages', controls: ['pages', 'pagesCustom'] },
  { title: 'Crop', controls: ['autoCrop', 'openEditor', 'useSaved', 'editSaved', 'clearSaved', 'savedInfo', 'learnedInfo', 'forgetLearned'] },
  { title: 'Defaults', controls: ['setDefault', 'resetDefault'] },
  { title: 'Download', controls: ['exportPdf', 'exportPng'], download: true },
];

// Sections shown on the Home tab without "More options"
export const HOME_ALWAYS = ['Process', 'Text on label', 'Output', 'Download'];

export const FONTS = ['Times New Roman', 'Arial', 'Verdana', 'Georgia', 'Courier New'];
