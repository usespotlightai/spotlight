import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import type { Ref, UIEventHandler } from 'react';
import { cn } from '@/lib/utils';

type Orientation = 'vertical' | 'horizontal' | 'both';

type ScrollbarShown = 'on-hover' | 'while-scrolling' | 'hidden';

type ScrollAreaProps = Omit<ScrollAreaPrimitive.Root.Props, 'onScroll'> & {
  orientation?: Orientation;
  scrollbar?: ScrollbarShown;
  viewportRef?: Ref<HTMLDivElement>;
  viewportClassName?: string;
  contentClassName?: string;
  onScroll?: UIEventHandler<HTMLDivElement>;
};

const VIEWPORT_OVERFLOW = {
  vertical: { overflowX: 'hidden' },
  horizontal: { overflowY: 'hidden' },
  both: {},
} as const;

function ScrollArea({
  className,
  orientation = 'vertical',
  scrollbar = 'on-hover',
  viewportRef,
  viewportClassName,
  contentClassName,
  onScroll,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative flex min-h-0 flex-col', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        onScroll={onScroll}
        style={VIEWPORT_OVERFLOW[orientation]}
        className={cn(
          'min-h-0 flex-auto rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          viewportClassName,
        )}
      >
        <ScrollAreaPrimitive.Content
          data-slot="scroll-area-content"
          style={orientation === 'vertical' ? { minWidth: 0 } : undefined}
          className={contentClassName}
        >
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {scrollbar !== 'hidden' && orientation !== 'horizontal' && (
        <ScrollBar orientation="vertical" shown={scrollbar} />
      )}
      {scrollbar !== 'hidden' && orientation !== 'vertical' && (
        <ScrollBar orientation="horizontal" shown={scrollbar} />
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = 'vertical',
  shown = 'on-hover',
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props & { shown?: ScrollbarShown }) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'z-30 flex touch-none select-none p-0.5 opacity-0 transition-opacity duration-150 data-scrolling:opacity-100 data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col',
        shown === 'on-hover' && 'data-hovering:opacity-100',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-(--scrollbar-thumb) hover:bg-(--scrollbar-thumb-hover)"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea };
