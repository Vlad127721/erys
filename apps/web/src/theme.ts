import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

/**
 * `<html data-theme>` is the single source of truth: CSS tokens read it, charts read it via
 * useTheme(). The inline script in index.html sets it before first paint (saved choice or OS).
 */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    console.log('hmmm')
  }
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/** Current theme. Charts need it in JS: Recharts writes SVG attributes, which cannot read CSS variables. */
export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
    () => 'light',
  );
}
