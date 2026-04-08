import { useEffect, useState } from 'react';

/**
 * useDarkMode — Hook para gestionar el modo oscuro del CMS
 *
 * - Persiste la preferencia en localStorage
 * - Si no hay preferencia, usa prefers-color-scheme del SO
 * - Aplica data-theme="dark" en <html>
 */

const STORAGE_KEY = 'osalnes_theme';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export function useDarkMode(): { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  // Apply on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  };

  const toggle = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return { theme, toggle, setTheme };
}

/** Apply the saved theme on app boot — call this in main.tsx before React renders */
export function bootstrapTheme(): void {
  applyTheme(getInitialTheme());
}
