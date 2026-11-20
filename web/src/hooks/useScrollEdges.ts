import { useCallback, useEffect, useRef, useState } from 'react';

export function useScrollEdges() {
  const viewport = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ up: false, down: false });

  const measure = useCallback(() => {
    const el = viewport.current;
    if (!el) {
      return;
    }

    const up = el.scrollTop > 1;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;

    setEdges((was) =>
      was.up === up && was.down === down ? was : { up, down },
    );
  }, []);

  useEffect(() => {
    const el = viewport.current;
    if (!el) {
      return;
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of el.children) {
      observer.observe(child);
    }
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return { viewport, edges, measure };
}
