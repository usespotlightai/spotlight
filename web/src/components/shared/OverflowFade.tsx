import { type ReactNode, useRef } from 'react';
import { useOverflows } from '@/hooks/useOverflows';
import { cn } from '@/lib/utils';

type OverflowFadeProps = {
  className?: string;
  slot?: string;
  children: ReactNode;
};

export function OverflowFade({ className, slot, children }: OverflowFadeProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const scrolls = useOverflows(scroller, true);

  return (
    <div className="relative min-w-0">
      <div
        ref={scroller}
        data-slot={slot}
        className={cn(
          '-mr-3 overflow-y-auto overscroll-contain pr-3',
          scrolls && 'pb-12',
          className,
        )}
      >
        {children}
      </div>
      {scrolls && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-card"
        />
      )}
    </div>
  );
}
