import type { CSSProperties, ReactNode, Ref } from 'react';
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
  const { width, resizing, handleProps, paneRef } = usePaneWidth<HTMLElement>({
    ...pane,
    edge: 'left',
    property: '--detail-w',
  });

  const openState = {
    'data-closed': open ? undefined : '',
    'data-open': open ? '' : undefined,
  };

  return (
    <div
      ref={(node) => {
        paneRef.current = node;

        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      style={
        {
          '--detail-w': `${width}px`,
          animationDuration: `${duration}ms`,
        } as CSSProperties
      }
      {...openState}
      className={cn(
        'relative w-[var(--detail-w)] shrink-0',
        'data-open:[animation:detail-room-open_240ms_ease-in-out]',
        'data-closed:[animation:detail-room-close_240ms_ease-in-out_forwards]',
      )}
    >
      <aside
        {...openState}
        style={{
          width: 'calc(var(--detail-w) - 16px)',
          animationDuration: `${duration}ms`,
        }}
        className={cn(
          'absolute inset-y-2 right-2 flex flex-col overflow-hidden rounded-lg border-[0.5px] border-border bg-card shadow-pane',
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
        className="inset-y-2 left-1"
      />
    </div>
  );
}
