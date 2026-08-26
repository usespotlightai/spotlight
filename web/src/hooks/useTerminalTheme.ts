import type { ITheme } from '@xterm/xterm';
import { useEffect, useState } from 'react';

const colour = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * The terminal's palette, read from the same tokens the rest of the app uses
 * so light and dark stay in step.
 */
const read = (): ITheme => ({
  background: colour('--background'),
  foreground: colour('--foreground'),
  cursor: colour('--foreground'),
  cursorAccent: colour('--background'),
  selectionBackground: colour('--accent'),
});

const same = (a: ITheme, b: ITheme) =>
  a.background === b.background && a.foreground === b.foreground;

/**
 * Follows the appearance the page is in. A media query switches the tokens, so
 * the stylesheet is always right; the job here is noticing when to read it
 * again, because CSS cannot repaint a canvas.
 *
 * `change` should be enough, but it has been seen not to fire while the query
 * already reports the new value. Returning to the page is treated as a second
 * chance to catch up, and the read is cheap.
 */
export function useTerminalTheme(): ITheme {
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const recheck = () =>
      setTheme((current) => {
        const now = read();
        return same(current, now) ? current : now;
      });

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', recheck);
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);

    return () => {
      query.removeEventListener('change', recheck);
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, []);

  return theme;
}
