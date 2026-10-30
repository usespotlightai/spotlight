import type { ReactNode } from 'react';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { usePaneWidth } from '@/hooks/usePaneWidth';
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

      <div className="flex min-w-0 flex-1 flex-col p-2 md:pl-0">
        {tabs}

        <section className="flex min-h-0 flex-1 flex-col overflow-clip rounded-lg border-[0.5px] border-border bg-surface shadow-pane">
          {children}
        </section>
      </div>
    </div>
  );
}
