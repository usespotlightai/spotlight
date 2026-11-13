import type { ReactNode, Ref } from 'react';

import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { cn } from '@/lib/utils';

export interface PaneConfig {
  storageKey: string;
  min: number;
  max: number;
  initial: number;
  label: string;
}

export function SidePane({
  pane,
  open,
  duration = 240,
  ref,
  children,
}: {
  pane: PaneConfig;
  open: boolean;
  duration?: number;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  const { resizing, handleProps, paneRef } = usePaneWidth({
    ...pane,
    edge: 'left',
    property: '--detail-w',
  });

  const openState = {
    'data-closed': open ? undefined : '',
    'data-open': open ? '' : undefined,
  };

  return (
    <>
      <div
        aria-hidden
        {...openState}
        style={{ animationDuration: `${duration}ms` }}
        className="pointer-events-none absolute inset-0 z-30 hidden bg-background/60 @max-4xl/pane:block data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-closed:fill-mode-forwards"
      />
      <div
        ref={(node) => {
          paneRef.current = node;

          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        style={{ animationDuration: `${duration}ms` }}
        {...openState}
        className={cn(
          'relative w-[var(--detail-w)] shrink-0 @4xl/pane:max-w-[calc(100cqw-24rem)]',
          '@max-4xl/pane:absolute @max-4xl/pane:inset-y-0 @max-4xl/pane:right-0 @max-4xl/pane:z-30 @max-4xl/pane:w-[min(var(--detail-w),100%)]',
          '@4xl/pane:data-open:[animation:detail-room-open_240ms_ease-in-out]',
          '@4xl/pane:data-closed:[animation:detail-room-close_240ms_ease-in-out_forwards]',
        )}
      >
        <aside
          {...openState}
          style={{ animationDuration: `${duration}ms` }}
          className={cn(
            'absolute inset-y-2 right-2 w-[calc(min(var(--detail-w),100cqw-24rem)-8px)] @max-4xl/pane:w-[calc(100%-16px)]',
            'flex flex-col overflow-hidden rounded-lg border-[0.5px] border-border bg-card shadow-pane',
            'data-open:[animation:detail-open_240ms_ease-in-out]',
            'data-closed:[animation:detail-close_240ms_ease-in-out_forwards]',
            resizing && 'select-none',
          )}
        >
          {children}
        </aside>

        <PaneHandle
          {...handleProps}
          edge="left"
          resizing={resizing}
          className="inset-y-2 @max-4xl/pane:hidden"
        />
      </div>
    </>
  );
}
