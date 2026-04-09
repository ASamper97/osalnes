import { useEffect, useState } from 'react';

/**
 * useDarkMode — Hook para gestionar el modo oscuro del CMS
 *
 * - Tema claro por defecto (acuerdo con la Mancomunidad de O Salnes)
 * - Persiste la preferencia en localStorage solo si el usuario la activa
 * - El SO no influye: aunque tenga modo oscuro, el CMS arranca en claro
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
  // Default: light. Ignoramos prefers-color-scheme a proposito para que el
  // CMS sea consistente entre dispositivos y no sorprenda a usuarios cuyo
  // SO esta en oscuro pero esperan ver la marca institucional en claro.
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
