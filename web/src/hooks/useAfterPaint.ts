import { useEffect, useState } from 'react';

export function useAfterPaint(active: boolean): boolean {
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (!active) {
      setPainted(false);
      return;
    }

    let timer = 0;
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setPainted(true));
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [active]);

  return active && painted;
}
