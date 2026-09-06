import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

const FADE = '1.5rem';

/**
 * A scroll box that fades whichever edge still has content beyond it, so a
 * capped list reads as continuing rather than cut off. The fade is a mask on
 * the content, so it sits on any background and needs no matching colour.
 */
export function FadingScroll({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ up: false, down: false });

  const measure = useCallback(() => {
    const el = ref.current;
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
    const el = ref.current;
    if (!el) {
      return;
    }

    measure();

    // The content growing or the viewport changing both move the edges, so
    // both are watched, not only the reader's own scroll.
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

  // Solid at an edge with nothing past it, transparent where it can still
  // scroll — so only the edge worth fading fades.
  const top = edges.up ? 'transparent' : '#000';
  const bottom = edges.down ? 'transparent' : '#000';
  const mask = `linear-gradient(to bottom, ${top} 0, #000 ${FADE}, #000 calc(100% - ${FADE}), ${bottom} 100%)`;

  return (
    <div
      ref={ref}
      onScroll={measure}
      className={cn('overflow-y-auto scrollbar-hide', className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  );
}
