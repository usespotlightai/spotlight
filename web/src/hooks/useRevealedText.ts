import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '@/lib/motion';

export const REVEAL_MS = 350;

const wordEnd = (text: string, at: number): number => {
  const space = text.slice(at).search(/\s/);
  return space === -1 ? text.length : at + space;
};

export function useRevealedText(text: string): string {
  const [shown, setShown] = useState(text);
  const showing = useRef(text);

  useEffect(() => {
    const from = showing.current;
    if (from === text) {
      return;
    }

    const show = (next: string) => {
      showing.current = next;
      setShown(next);
    };
    const growing = text.startsWith(from) && !prefersReducedMotion();
    const start = performance.now();
    let frame = 0;
    const reveal = (now: number) => {
      const done = growing ? Math.min(1, (now - start) / REVEAL_MS) : 1;
      const end =
        done === 1
          ? text.length
          : wordEnd(
              text,
              from.length + Math.round((text.length - from.length) * done),
            );
      show(text.slice(0, end));
      if (done < 1) {
        frame = requestAnimationFrame(reveal);
      }
    };
    frame = requestAnimationFrame(reveal);

    return () => cancelAnimationFrame(frame);
  }, [text]);

  return shown;
}
