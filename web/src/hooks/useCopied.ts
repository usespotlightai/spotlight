import { useCallback, useEffect, useRef, useState } from 'react';

const SETTLE_MS = 2000;

/** Copies text and says so for a moment afterwards. */
export function useCopied() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }

    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), SETTLE_MS);
  }, []);

  return { copied, copy };
}
