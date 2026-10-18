import type { ReactNode, Ref, UIEventHandler } from 'react';

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
    <div
      ref={ref}
      onScroll={onScroll}
      className="relative flex min-h-0 flex-1 overflow-y-auto"
    >
      <div className="flex min-h-full min-w-0 flex-1 flex-col self-start">
        <div className="flex flex-1 flex-col">{children}</div>
        {footer && <div className="sticky bottom-0 z-20">{footer}</div>}
      </div>

      {sidePanel && (
        <div className="sticky top-0 flex h-full shrink-0 self-start">
          {sidePanel}
        </div>
      )}
    </div>
  );
}
