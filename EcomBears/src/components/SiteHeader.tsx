import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

// Top bar shared by every page. Pages can add a button on the right.
export default function SiteHeader({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const onLanding = pathname === '/';

  return (
    <header className="topbar">
      <Link className="brand" to="/">
        <span className="brand-mark" aria-hidden>🐻</span>
        LabelCropper
      </Link>

      <nav className="nav-links" aria-label="Main">
        <Link to="/" className={onLanding ? 'active' : ''}>Home</Link>
        <Link to="/tool" className={pathname === '/tool' ? 'active' : ''}>Tool</Link>
        {onLanding && <a href="#platforms">Platforms</a>}
        {onLanding && <a href="#features">Features</a>}
      </nav>

      <div className="topbar-right">
        <span className="privacy">🔒 Files stay on your computer</span>
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}