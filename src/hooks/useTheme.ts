import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

// Matches --surface in app.css (the header's colour) so the browser chrome blends into it.
const THEME_COLORS = { light: '#fffefb', dark: '#1c1c19' } as const;

function applyResolved(resolved: 'light' | 'dark', forced: boolean) {
  const root = document.documentElement;
  if (forced) root.setAttribute('data-theme', resolved);
  else root.removeAttribute('data-theme');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);
}

/**
 * Applies the user's theme preference to the document. 'light'/'dark' force a
 * `data-theme` attribute; 'system' removes it and follows prefers-color-scheme,
 * updating live when the OS scheme changes.
 */
export function useTheme() {
  const theme = useAppStore((s) => s.settings.theme);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)');

    const sync = () => {
      if (theme === 'system') {
        applyResolved(query.matches ? 'light' : 'dark', false);
      } else {
        applyResolved(theme, true);
      }
    };

    sync();
    if (theme === 'system') {
      query.addEventListener('change', sync);
      return () => query.removeEventListener('change', sync);
    }
  }, [theme]);
}
