import { type ReactNode, useState } from 'react';

import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { SidebarToggle } from '@/components/shell/layout/SidebarToggle';
import { useCollapsedSidebar } from '@/hooks/useCollapsedSidebar';
import { useDragToClose } from '@/hooks/useDragToClose';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { framesWindow } from '@/lib/desktop';
import { cn } from '@/lib/utils';

type DashboardLayoutProps = {
  sidebar?: ReactNode;
  tabs?: ReactNode;
  split?: ReactNode;
  focused?: SectionName;
  onCollapse?: (section: SectionName) => void;
  children?: ReactNode;
};

type SectionName = 'main' | 'split';

const SPLIT_CLOSES_AT_PX = 160;

const SIDEBAR_CLOSES_AT_PX = 96;

const SPLIT_PANE = {
  storageKey: 'spotlight.split-width',
  min: 320,
  max: 1600,
  initial: 560,
  label: 'Resize split view',
  edge: 'left' as const,
};

const PANE_SECTION =
  'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip rounded-lg border-[0.5px] border-border bg-surface shadow-pane transition-[border-color,opacity] data-focused:border-foreground/25 data-collapsing:opacity-40';

export function DashboardLayout({
  sidebar,
  tabs,
  split,
  focused = 'main',
  onCollapse,
  children,
}: DashboardLayoutProps) {
  const [collapsing, setCollapsing] = useState<SectionName | null>(null);
  const [closingSidebar, setClosingSidebar] = useState(false);
  const { width, resizing, handleProps, paneRef, resize } = usePaneWidth();
  const sidebarState = useCollapsedSidebar(paneRef);
  const { collapsed, peeking } = sidebarState;
  const hidden = collapsed && !peeking;
  const sidebarHandle = useDragToClose({
    width,
    direction: 1,
    paneRef,
    handleProps,
    resize,
    closingAt: (wanted) => (wanted < SIDEBAR_CLOSES_AT_PX ? true : null),
    onClosing: (closing) => setClosingSidebar(closing ?? false),
    onClose: sidebarState.collapse,
  });
  const toggle = (
    <SidebarToggle
      collapsed={collapsed}
      onToggle={collapsed ? sidebarState.expand : sidebarState.collapse}
    />
  );

  return (
    <div
      className={cn(
        'flex h-svh bg-background',
        framesWindow() && 'bg-background/40',
        resizing && 'cursor-col-resize select-none',
      )}
    >
      {collapsed && (
        <div
          aria-hidden
          data-slot="sidebar-backdrop"
          onClick={sidebarState.unpeek}
          className={cn(
            'fixed inset-0 z-40 hidden bg-black/10 transition-opacity duration-200 supports-backdrop-filter:backdrop-blur-xs md:block',
            peeking ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        />
      )}

      {collapsed && (
        <div
          aria-hidden
          data-slot="sidebar-peek"
          onPointerEnter={sidebarState.peek}
          className="fixed inset-y-0 left-0 z-40 hidden w-2 md:block"
        />
      )}

      <aside
        ref={paneRef}
        style={{ width }}
        inert={hidden || undefined}
        data-collapsed={collapsed || undefined}
        data-peeking={peeking || undefined}
        className={cn(
          'relative hidden shrink-0 flex-col overflow-hidden px-3 py-2 transition-opacity md:flex',
          closingSidebar && 'opacity-40',
          collapsed &&
            'fixed top-11 bottom-2 left-2 z-50 rounded-lg border-[0.5px] border-border bg-background shadow-lg transition-[translate,opacity] duration-200 ease-out',
          hidden &&
            'pointer-events-none -translate-x-[calc(100%+1rem)] opacity-0',
        )}
      >
        {framesWindow() && !collapsed && (
          <div
            data-slot="window-buttons"
            className="flex h-8 shrink-0 items-center pl-[4.25rem]"
          >
            {sidebar && toggle}
          </div>
        )}
        {sidebar}
      </aside>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col p-2',
          !collapsed && 'md:pl-0',
        )}
      >
        <div
          className={cn(
            'flex min-w-0 items-start gap-1.5',
            collapsed && framesWindow() && 'md:pl-[4.5rem]',
          )}
        >
          {sidebar && collapsed && (
            <div
              className="relative z-50 hidden pb-2 md:block"
              onPointerEnter={sidebarState.peek}
            >
              {toggle}
            </div>
          )}
          <div className="min-w-0 flex-1">{tabs}</div>
        </div>

        <div className="relative flex min-h-0 flex-1 gap-2">
          {!collapsed && (
            <PaneHandle
              {...handleProps}
              {...sidebarHandle}
              edge="left"
              resizing={resizing}
              className="hidden md:block"
            />
          )}

          <section
            data-focused={(split && focused === 'main') || undefined}
            data-collapsing={collapsing === 'main' || undefined}
            className={PANE_SECTION}
          >
            {children}
          </section>

          {split && (
            <SplitSection
              focused={focused === 'split'}
              collapsing={collapsing}
              onCollapsing={setCollapsing}
              onCollapse={(section) => onCollapse?.(section)}
            >
              {split}
            </SplitSection>
          )}
        </div>
      </div>
    </div>
  );
}

type SplitSectionProps = {
  focused: boolean;
  collapsing: SectionName | null;
  onCollapsing: (section: SectionName | null) => void;
  onCollapse: (section: SectionName) => void;
  children: ReactNode;
};

function SplitSection({
  focused,
  collapsing,
  onCollapsing,
  onCollapse,
  children,
}: SplitSectionProps) {
  const { width, resizing, handleProps, paneRef, resize } =
    usePaneWidth<HTMLDivElement>(SPLIT_PANE);
  const closingHandle = useDragToClose<SectionName>({
    width,
    direction: -1,
    paneRef,
    handleProps,
    resize,
    closingAt: (wanted, room) => {
      if (wanted < SPLIT_CLOSES_AT_PX) {
        return 'split';
      }

      return wanted > room - SPLIT_CLOSES_AT_PX ? 'main' : null;
    },
    onClosing: onCollapsing,
    onClose: onCollapse,
  });

  return (
    <div
      ref={paneRef}
      style={{ width }}
      className="relative hidden max-w-[calc(100%-20rem)] shrink-0 flex-col md:flex"
    >
      <PaneHandle
        {...handleProps}
        {...closingHandle}
        edge="left"
        resizing={resizing}
        className="-left-2"
      />

      <section
        data-focused={focused || undefined}
        data-collapsing={collapsing === 'split' || undefined}
        className={PANE_SECTION}
      >
        {children}
      </section>
    </div>
  );
}
