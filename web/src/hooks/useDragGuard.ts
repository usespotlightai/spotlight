import { useCallback, useEffect, useRef } from 'react';

const GRACE_MS = 300;

export function useDragGuard() {
  const pending = useRef<((event: MouseEvent) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const forget = useCallback(() => {
    if (pending.current) {
      document.removeEventListener('click', pending.current, true);
      pending.current = null;
    }
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => forget, [forget]);

  return useCallback(() => {
    forget();

    const swallow = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      forget();
    };

    pending.current = swallow;
    document.addEventListener('click', swallow, { capture: true });
    timer.current = setTimeout(forget, GRACE_MS);
  }, [forget]);
}
