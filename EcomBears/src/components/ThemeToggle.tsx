import { useState } from 'react';
import { getTheme, setTheme, type Theme } from '../lib/theme';

// Switches between light and dark. The icon shows what you will switch to.
export default function ThemeToggle() {
  const [theme, setLocal] = useState<Theme>(getTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  const toggle = () => {
    setTheme(next);
    setLocal(next);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {next === 'dark' ? '🌙' : '☀️'}
      <span>{next === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}