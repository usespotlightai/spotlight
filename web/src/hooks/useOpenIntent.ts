import { useEffect, useRef } from 'react';

const HOVER_INTENT_MS = 80;

// Calls intent when a row is about to be opened: after a short hover, or on keyboard focus.
export function useOpenIntent(intent: (() => void) | undefined) {
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!intent) {
    return {};
  }

  return {
    onPointerEnter: () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(intent, HOVER_INTENT_MS);
    },
    onPointerLeave: () => window.clearTimeout(timer.current),
    onFocusCapture: intent,
  };
}
