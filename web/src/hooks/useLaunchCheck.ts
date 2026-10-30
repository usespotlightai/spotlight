import { useCallback, useEffect, useRef, useState } from 'react';

const LAUNCH_WAIT_MS = 2_000;

export function useLaunchCheck(waitMs = LAUNCH_WAIT_MS) {
  const [missed, setMissed] = useState(false);
  const stop = useRef<() => void>(() => {});

  useEffect(() => () => stop.current(), []);

  const launched = useCallback(() => {
    stop.current();
    setMissed(false);

    const left = () => stop.current();
    const timer = setTimeout(() => {
      stop.current();
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        setMissed(true);
      }
    }, waitMs);

    window.addEventListener('blur', left);
    document.addEventListener('visibilitychange', left);
    stop.current = () => {
      clearTimeout(timer);
      window.removeEventListener('blur', left);
      document.removeEventListener('visibilitychange', left);
      stop.current = () => {};
    };
  }, [waitMs]);

  const dismiss = useCallback(() => setMissed(false), []);

  return { missed, launched, dismiss };
}
