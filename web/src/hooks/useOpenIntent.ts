import { useEffect, useRef } from 'react';

const HOVER_INTENT_MS = 80;

type OpenIntentResult = {
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onFocusCapture?: () => void;
};

export function useOpenIntent(
  intent: (() => void) | undefined,
): OpenIntentResult {
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
