import type { ReactNode } from 'react';
import { PaneHandle } from '@/components/layout/PaneHandle';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { cn } from '@/lib/utils';

type DashboardLayoutProps = {
  sidebar?: ReactNode;
  children?: ReactNode;
};

export function DashboardLayout({ sidebar, children }: DashboardLayoutProps) {
  const { width, resizing, handleProps, paneRef } = usePaneWidth<HTMLElement>();

  return (
    <div
      className={cn(
        'flex h-svh bg-background',
        resizing && 'cursor-col-resize select-none',
      )}
    >
      <aside
        ref={paneRef}
        style={{ width }}
        className="relative hidden shrink-0 flex-col px-3 py-2 md:flex"
      >
        {sidebar}

        <PaneHandle {...handleProps} edge="right" resizing={resizing} />
      </aside>

      <div className="min-w-0 flex-1 p-2 md:pl-0">
        <section className="flex h-full flex-col overflow-hidden rounded-lg border-[0.5px] border-border bg-surface shadow-pane">
          {children}
        </section>
      </div>
    </div>
  );
}
