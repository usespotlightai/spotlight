import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

const FADE = '1.5rem';

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

  const top = edges.up ? 'transparent' : '#000';
  const bottom = edges.down ? 'transparent' : '#000';
  const mask = `linear-gradient(to bottom, ${top} 0, #000 ${FADE}, #000 calc(100% - ${FADE}), ${bottom} 100%)`;

  return (
    <ScrollArea
      viewportRef={ref}
      onScroll={measure}
      className={className}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </ScrollArea>
  );
}
