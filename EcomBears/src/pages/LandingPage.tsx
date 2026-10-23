import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import PlatformCard from '../components/PlatformCard';
import FeatureCard from '../components/FeatureCard';

const PLATFORMS = [
  {
    name: 'Amazon India', letter: 'A', to: '/tool?platform=amazon',
    text: 'Finds the shipping label on Amazon\'s printout. Removes the instructions, notes and extra margins. Can print the SKU under each label.',
    tags: ['Address block', 'Barcode', 'Auto-trim', 'SKU text'],
  },
  {
    name: 'Flipkart', letter: 'F', to: '/tool?platform=flipkart',
    text: 'Finds the main shipment label on Flipkart\'s multi-box layout, removes white padding, and gives you a clean 4×6 label.',
    tags: ['Shipment label', 'Double-label split', 'White trim'],
  },
  {
    name: 'Meesho', letter: 'M', to: '/tool?platform=meesho',
    text: 'Finds the Valmo label above the tax invoice, using the invoice heading as the marker.',
    tags: ['Valmo', 'Tax invoice anchor'],
  },
  {
    name: 'Myntra', letter: 'My', to: '/tool?platform=myntra',
    text: 'The first label sets the crop size. Every later label from Myntra uses it, so one setup covers the whole batch.',
    tags: ['Learned size', 'SKU text'],
  },
  {
    name: 'Snapdeal', letter: 'S', to: '/tool?platform=snapdeal',
    text: 'Uses the same learned size, and can print the SKU ID or product description under each label.',
    tags: ['Learned size', 'SKU text'],
  },
  {
    name: 'Auto detect', letter: '🔍', to: '/tool?platform=auto',
    text: 'Not sure which platform your PDF is from? We look for the label on any shipping PDF.',
    tags: ['Any PDF', 'Text + layout'],
  },
];

const FEATURES = [
  { icon: '⚡', title: 'Instant processing', text: 'Labels are processed in your browser. Most PDFs finish in a few seconds.' },
  { icon: '🔒', title: '100% private', text: 'Your shipping data never leaves your device. No uploads, no storage, no tracking.' },
  { icon: '🧠', title: 'Smart auto-crop', text: 'Finds the label on each page, removes instructions and padding, and remembers the size for the rest of the batch.' },
  { icon: '📦', title: 'Batch processing', text: 'Add many PDFs at once. Download every label in one PDF, sorted by SKU or courier if you want.' },
  { icon: '✂️', title: 'Crop editor', text: 'Not quite right? Drag the crop box on the original page, then save it for all labels or just one.' },
  { icon: '🖨', title: 'Print-ready output', text: 'Exact 4×6 inch (101.6 × 152.4 mm) pages at 203 DPI. Plug in your printer and print.' },
];

const COMING_SOON = [
  { title: 'Profit tracking', text: 'See profit after fees, returns and tool costs, across all your marketplaces.' },
  { title: 'Listing manager', text: 'Manage products and listings from Amazon, Flipkart and Meesho in one place.' },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <SiteHeader>
        <Link className="btn-primary" to="/tool">Start free →</Link>
      </SiteHeader>

      <section className="hero">
        <div className="hero-inner">
          <span className="badge">Free · Private · Instant</span>
          <h1>Shipping labels, <span className="accent">ready for your thermal printer</span></h1>
          <p className="hero-sub">
            Upload your Amazon, Flipkart, Meesho, Myntra or Snapdeal label PDFs. We find the label on each page
            and give you 4 × 6 inch labels. Everything is processed in your browser, so no data leaves your device.
          </p>
          <div className="hero-actions">
            <Link className="btn-primary btn-large" to="/tool">Start converting</Link>
            <a className="btn-ghost btn-large" href="#platforms">See platforms ↓</a>
          </div>

          <div className="stats">
            <div className="stat"><strong>4×6"</strong><span>Thermal label size</span></div>
            <div className="stat"><strong>203</strong><span>DPI output</span></div>
            <div className="stat"><strong>0</strong><span>Bytes uploaded</span></div>
            <div className="stat"><strong>100+</strong><span>Labels per batch</span></div>
          </div>
        </div>
      </section>

      <main className="wrap">
        <section className="section" id="platforms">
          <span className="badge">Supported platforms</span>
          <h2 className="section-title">Built for India's top eCommerce platforms</h2>
          <p className="section-desc">Each platform has its own settings, saved on this computer.</p>
          <div className="grid">
            {PLATFORMS.map(p => (
              <PlatformCard key={p.name} name={p.name} letter={p.letter} to={p.to} text={p.text} tags={p.tags} />
            ))}
          </div>
        </section>

        <section className="section" id="features">
          <span className="badge">Features</span>
          <h2 className="section-title">Everything you need</h2>
          <p className="section-desc">Professional label processing, free and private.</p>
          <div className="grid">
            {FEATURES.map(f => <FeatureCard key={f.title} icon={f.icon} title={f.title} text={f.text} />)}
          </div>
        </section>

        <section className="section">
          <span className="badge">Coming soon</span>
          <h2 className="section-title">A seller dashboard on the same site</h2>
          <p className="section-desc">We're building it step by step. Tell us what you need first.</p>
          <div className="grid">
            {COMING_SOON.map(f => <FeatureCard key={f.title} title={f.title} text={f.text} soon />)}
          </div>
        </section>

        <section className="cta">
          <h2>Ready to print your labels?</h2>
          <p>Drop your PDFs in and download a thermal-ready file in under a minute.</p>
          <Link className="btn-primary btn-large" to="/tool">Open the tool</Link>
        </section>
      </main>

      <footer className="site-footer">
        <span>© 2026 LabelCropper · Built for sellers</span>
        <span>100% client-side</span>
      </footer>
    </div>
  );
}