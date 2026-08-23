import type { ReactNode } from 'react';
import { useSidebarWidth } from '@/hooks/useSidebarWidth';
import { cn } from '@/lib/utils';

type DashboardLayoutProps = {
  sidebar?: ReactNode;
  children?: ReactNode;
};

export function DashboardLayout({ sidebar, children }: DashboardLayoutProps) {
  const { width, resizing, handleProps } = useSidebarWidth();

  return (
    <div
      className={cn(
        'flex h-svh bg-background',
        resizing && 'cursor-col-resize select-none',
      )}
    >
      <aside
        style={{ width }}
        className="relative hidden shrink-0 flex-col px-3 py-2 md:flex"
      >
        {sidebar}

        <div
          {...handleProps}
          className={cn(
            'absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize outline-none',
            'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:opacity-0 after:transition-opacity',
            resizing && 'after:opacity-100',
          )}
        />
      </aside>

      <div className="min-w-0 flex-1 p-2 md:pl-0">
        <section className="flex h-full flex-col overflow-hidden rounded-lg border-[0.5px] border-border bg-card">
          {children}
        </section>
      </div>
    </div>
  );
}
