import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ScrollAreaProps = {
  className?: string;
  children: ReactNode;
};

export function ScrollArea({ className, children }: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn('relative min-h-0 overflow-hidden', className)}
    >
      <ScrollAreaPrimitive.Viewport className="h-full overscroll-contain outline-none">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="absolute top-0 right-0 bottom-0 flex w-2.5 touch-none select-none justify-center p-0.5 opacity-0 transition-opacity delay-300 duration-200 data-[hovering]:opacity-100 data-[scrolling]:opacity-100 data-[hovering]:delay-0 data-[scrolling]:delay-0"
      >
        <ScrollAreaPrimitive.Thumb className="w-full rounded-full bg-[var(--scrollbar-thumb)] hover:bg-[var(--scrollbar-thumb-hover)]" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}
