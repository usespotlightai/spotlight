import type { ReactNode, Ref, UIEventHandler } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

type PaneScrollerProps = {
  sidePanel?: ReactNode;
  footer?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  onScroll?: UIEventHandler<HTMLDivElement>;
  children: ReactNode;
};

export function PaneScroller({
  sidePanel,
  footer,
  ref,
  onScroll,
  children,
}: PaneScrollerProps) {
  return (
    <div className="relative flex min-h-0 flex-1">
      <ScrollArea
        viewportRef={ref}
        onScroll={onScroll}
        className="min-w-0 flex-1"
        contentClassName="flex min-h-full flex-col"
      >
        <div className="flex flex-1 flex-col">{children}</div>
        {footer && <div className="sticky bottom-0 z-20">{footer}</div>}
      </ScrollArea>

      {sidePanel && <div className="flex shrink-0">{sidePanel}</div>}
    </div>
  );
}
