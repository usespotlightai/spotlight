import type { ReactNode } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useScrollEdges } from '@/hooks/useScrollEdges';

const FADE = 'min(1.5rem, 25%)';

export function FadingScroll({
  className,
  contentClassName,
  children,
}: {
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const { viewport, edges, measure } = useScrollEdges();

  const top = edges.up ? 'transparent' : '#000';
  const bottom = edges.down ? 'transparent' : '#000';
  const mask = `linear-gradient(to bottom, ${top} 0, #000 ${FADE}, #000 calc(100% - ${FADE}), ${bottom} 100%)`;

  return (
    <ScrollArea
      viewportRef={viewport}
      onScroll={measure}
      className={className}
      contentClassName={contentClassName}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </ScrollArea>
  );
}
