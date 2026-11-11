import type { ReactNode } from 'react';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { framesWindow } from '@/lib/desktop';
import { cn } from '@/lib/utils';

type DashboardLayoutProps = {
  sidebar?: ReactNode;
  tabs?: ReactNode;
  children?: ReactNode;
};

export function DashboardLayout({
  sidebar,
  tabs,
  children,
}: DashboardLayoutProps) {
  const { width, resizing, handleProps, paneRef } = usePaneWidth<HTMLElement>();

  return (
    <div
      className={cn(
        'flex h-svh bg-background',
        framesWindow() && 'bg-background/40',
        resizing && 'cursor-col-resize select-none',
      )}
    >
      <aside
        ref={paneRef}
        style={{ width }}
        className="relative hidden shrink-0 flex-col px-3 py-2 md:flex"
      >
        {framesWindow() && (
          <div
            aria-hidden
            className="h-8 shrink-0"
            data-slot="window-buttons"
          />
        )}
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col p-2 md:pl-0">
        {tabs}

        <div className="relative flex min-h-0 flex-1 flex-col">
          <PaneHandle
            {...handleProps}
            edge="left"
            resizing={resizing}
            className="hidden md:block"
          />

          <section className="flex min-h-0 flex-1 flex-col overflow-clip rounded-lg border-[0.5px] border-border bg-surface shadow-pane">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
