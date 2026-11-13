import {
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  useState,
} from 'react';

import { CollapsibleSidebar } from '@/components/shell/layout/CollapsibleSidebar';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { useSidebarCollapsedSetting } from '@/hooks/useCollapsedSidebar';
import { useDragToClose } from '@/hooks/useDragToClose';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { useSettling } from '@/hooks/useSettling';
import { framesWindow } from '@/lib/desktop';
import { SPRING, SPRING_MS } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type Pane = { key: string; content: ReactNode };

type DashboardLayoutProps = {
  sidebar?: ReactNode;
  tabs?: ReactNode;
  panes?: Pane[];
  focused?: SectionName;
  onCollapse?: (section: SectionName) => void;
  children?: ReactNode;
};

type SectionName = 'main' | 'split';

type Leaving = { pane: Pane; section: SectionName };

const SPLIT_CLOSES_AT_PX = 160;

const PANE_GAP_PX = 8;

const SPLIT_PANE = {
  storageKey: 'spotlight.split-width',
  min: 320,
  max: 1600,
  initial: 560,
  label: 'Resize split view',
  edge: 'left' as const,
  property: '--split-width',
};

const PANE_SECTION =
  'relative flex min-h-0 min-w-[min(var(--pane-min),var(--split-cap))] flex-1 flex-col overflow-clip rounded-lg border-[0.5px] border-border bg-surface shadow-pane outline-none transition-opacity data-focused:border-foreground/25 data-collapsing:opacity-40';

const withLeaving = (panes: Pane[], leaving: Leaving | null) => {
  if (!leaving) {
    return panes;
  }

  const kept = panes.filter((pane) => pane.key !== leaving.pane.key);
  const at = leaving.section === 'main' ? 0 : 1;

  return [...kept.slice(0, at), leaving.pane, ...kept.slice(at)];
};

export function DashboardLayout({
  sidebar,
  tabs,
  panes,
  focused = 'main',
  onCollapse,
  children,
}: DashboardLayoutProps) {
  const collapsed = useSidebarCollapsedSetting();
  const desktop = framesWindow();
  const shown = panes ?? [{ key: 'main', content: children }];
  const [mainKey, setMainKey] = useState(shown[0].key);
  const steady = mainKey === shown[0].key;
  if (!steady) {
    setMainKey(shown[0].key);
  }
  const [dragging, setDragging] = useState<SectionName | null>(null);
  const [leaving, setLeaving] = useSettling<Leaving>();
  const [released, setReleased] = useSettling<true>();
  const columns = withLeaving(shown, leaving);
  const pane = usePaneWidth<HTMLDivElement>(SPLIT_PANE);
  const { resizing, handleProps, paneRef } = pane;

  const close = (section: SectionName) => {
    const at = section === 'main' ? 0 : 1;
    const row = paneRef.current;
    if (row?.children[at]?.contains(document.activeElement)) {
      row.children[1 - at]?.querySelector('section')?.focus();
    }

    setLeaving({ pane: shown[at], section });
    onCollapse?.(section);
  };

  const dragHandle = useDragToClose<SectionName>({
    pane,
    direction: -1,
    property: '--split-drag',
    closingAt: (wanted, room) => {
      if (wanted < SPLIT_CLOSES_AT_PX) {
        return 'split';
      }

      return wanted > room - SPLIT_CLOSES_AT_PX ? 'main' : null;
    },
    onClosing: setDragging,
    onClose: close,
  });

  return (
    <div
      style={
        {
          '--spring-duration': `${SPRING_MS}ms`,
          '--sidebar-toggle-left': desktop ? '5rem' : '0.5rem',
          '--sidebar-toggle-size': '1.75rem',
          '--sidebar-toggle-end':
            'calc(var(--sidebar-toggle-left) + var(--sidebar-toggle-size) + 0.375rem)',
          '--sidebar-floor': desktop ? 'var(--sidebar-toggle-end)' : '0.5rem',
        } as CSSProperties
      }
      className={cn(
        'flex h-svh overflow-clip bg-background',
        desktop && 'bg-background/40',
      )}
    >
      <CollapsibleSidebar>{sidebar}</CollapsibleSidebar>

      <div className="flex min-w-0 flex-1 flex-col p-2 md:pl-0">
        <div
          className={cn(
            'flex min-w-0 items-start transition-[padding]',
            SPRING,
            collapsed && 'md:pl-[calc(var(--sidebar-toggle-end)-0.5rem)]',
          )}
        >
          <div className="min-w-0 flex-1">{tabs}</div>
        </div>

        <div
          ref={paneRef}
          style={
            {
              '--pane-min': `${SPLIT_PANE.min}px`,
              '--pane-gap': `${PANE_GAP_PX}px`,
            } as CSSProperties
          }
          className="@container relative flex min-h-0 flex-1 gap-(--pane-gap) [--split-cap:max(calc(100cqw_-_var(--pane-min)_-_var(--pane-gap)),calc(50cqw_-_var(--pane-gap)_/_2))]"
        >
          {columns.map((column, index) => {
            const section: SectionName = index === 0 ? 'main' : 'split';
            const gone = column.key === leaving?.pane.key;

            return (
              <PaneColumn
                key={column.key}
                section={section}
                leaving={gone}
                fills={leaving?.section === 'main' && !gone}
                enters={steady}
                focused={shown.length > 1 && focused === section}
                collapsing={gone || dragging === section}
                resizing={resizing}
                released={released !== null}
                handle={
                  column.key === shown[1]?.key
                    ? {
                        ...handleProps,
                        ...dragHandle,
                        onPointerUp: (event) => {
                          setReleased(true);
                          dragHandle.onPointerUp(event);
                        },
                      }
                    : undefined
                }
              >
                {column.content}
              </PaneColumn>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type PaneColumnProps = {
  section: SectionName;
  leaving: boolean;
  fills: boolean;
  enters: boolean;
  focused: boolean;
  collapsing: boolean;
  resizing: boolean;
  released: boolean;
  handle?: Omit<ComponentProps<typeof PaneHandle>, 'edge' | 'resizing'>;
  children: ReactNode;
};

function PaneColumn({
  section,
  leaving,
  fills,
  enters,
  focused,
  collapsing,
  resizing,
  released,
  handle,
  children,
}: PaneColumnProps) {
  const main = section === 'main';

  return (
    <div
      inert={leaving || undefined}
      className={cn(
        'relative flex-col',
        main
          ? cn(
              'flex min-w-0 flex-1',
              leaving &&
                cn('mr-[calc(var(--pane-gap)*-1)] transition-[margin]', SPRING),
            )
          : cn(
              'hidden max-w-[max(var(--split-cap),var(--split-drag,0px))] shrink-0 md:flex',
              leaving && 'ml-[calc(var(--pane-gap)*-1)] w-0',
              fills && 'w-full max-w-none',
              !leaving && !fills && 'w-[var(--split-drag,var(--split-width))]',
              enters && 'starting:ml-[calc(var(--pane-gap)*-1)] starting:w-0',
              !resizing &&
                cn(
                  released
                    ? 'transition-[width,max-width,margin]'
                    : 'transition-[width,margin]',
                  SPRING,
                ),
            ),
      )}
    >
      {handle && (
        <PaneHandle
          {...handle}
          edge="left"
          resizing={resizing}
          className="-left-2"
        />
      )}

      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1',
          main
            ? 'justify-end [clip-path:inset(-2rem_-2rem_-2rem_0)]'
            : '[clip-path:inset(-2rem_0_-2rem_-2rem)]',
        )}
      >
        <section
          tabIndex={-1}
          data-focused={focused || undefined}
          data-collapsing={collapsing || undefined}
          className={cn(PANE_SECTION, SPRING)}
        >
          {children}
        </section>
      </div>
    </div>
  );
}
