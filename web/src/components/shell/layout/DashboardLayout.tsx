import {
  type ComponentProps,
  type CSSProperties,
  memo,
  type ReactNode,
  type Ref,
  startTransition,
  useEffect,
  useRef,
  useState,
} from 'react';

import { CollapsibleSidebar } from '@/components/shell/layout/CollapsibleSidebar';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { useSidebarCollapsedSetting } from '@/hooks/useCollapsedSidebar';
import { useDragToClose } from '@/hooks/useDragToClose';
import { useNarrowerThan } from '@/hooks/useNarrowerThan';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { useSettling } from '@/hooks/useSettling';
import { framesWindow } from '@/lib/desktop';
import { SPRING, SPRING_MS } from '@/lib/motion';
import { PANE_GAP_PX, PANE_MIN_PX, TWO_PANES_PX } from '@/lib/panes';
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

const SPLIT_PANE = {
  storageKey: 'spotlight.split-width',
  min: PANE_MIN_PX,
  max: 1600,
  initial: 560,
  label: 'Resize split view',
  edge: 'left' as const,
  property: '--split-width',
};

const SPLIT_CAP =
  'max(calc(100% - var(--pane-min) - var(--pane-gap)), calc(50% - var(--pane-gap) / 2))';

const SPLIT_ROOM = 'calc(100% - var(--pane-gap))';

const PANE_SECTION =
  '@container/pane relative flex min-h-0 flex-1 flex-col overflow-clip rounded-lg border-[0.5px] border-border bg-surface shadow-pane outline-none transition-opacity data-collapsing:opacity-40 md:data-focused:border-foreground/25';

const capOf = (row: HTMLElement | null) => {
  const room = row?.clientWidth;

  return room
    ? Math.max(room - PANE_MIN_PX - PANE_GAP_PX, (room - PANE_GAP_PX) / 2)
    : Infinity;
};

const styleOf = (
  element: HTMLElement | null,
  property: 'width' | 'maxWidth',
  value: string | null,
) => {
  if (element) {
    element.style[property] = value ?? '';
  }
};

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
  const splitRef = useRef<HTMLDivElement>(null);
  const pane = usePaneWidth<HTMLDivElement>({
    ...SPLIT_PANE,
    limit: (column) => capOf(column.parentElement),
    onDrag: (width) =>
      styleOf(splitRef.current, 'width', width === null ? null : `${width}px`),
  });
  const { resizing, handleProps, paneRef } = pane;
  const cramped = useNarrowerThan(paneRef, TWO_PANES_PX);
  const split = shown.length > 1;

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
    room: () => paneRef.current?.clientWidth ?? Infinity,
    follow: (wanted) => {
      const shown = wanted === null ? null : `${Math.max(0, wanted)}px`;
      styleOf(
        splitRef.current,
        'maxWidth',
        shown && `min(${SPLIT_ROOM}, max(${SPLIT_CAP}, ${shown}))`,
      );
      if (shown) {
        styleOf(splitRef.current, 'width', shown);
      }
    },
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
          '--sidebar-toggle-left': desktop ? '5.75rem' : '0.5rem',
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
            'max-md:pl-[calc(var(--sidebar-toggle-end)-0.5rem)]',
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
          className="relative flex min-h-0 flex-1 gap-(--pane-gap)"
        >
          {columns.map((column, index) => {
            const section: SectionName = index === 0 ? 'main' : 'split';
            const gone = column.key === leaving?.pane.key;
            const handled = column.key === shown[1]?.key;

            return (
              <PaneColumn
                key={column.key}
                ref={handled ? splitRef : undefined}
                section={section}
                leaving={gone}
                fills={leaving?.section === 'main' && !gone}
                focused={split && focused === section}
                folded={split && focused !== section}
                cramped={cramped}
                collapsing={gone || dragging === section}
                resizing={resizing}
                released={released !== null}
                handle={
                  handled
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
                <PaneContent defer={section === 'split' && steady}>
                  {column.content}
                </PaneContent>
              </PaneColumn>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type PaneColumnProps = {
  ref?: Ref<HTMLDivElement>;
  section: SectionName;
  leaving: boolean;
  fills: boolean;
  focused: boolean;
  folded: boolean;
  cramped: boolean;
  collapsing: boolean;
  resizing: boolean;
  released: boolean;
  handle?: Omit<ComponentProps<typeof PaneHandle>, 'edge' | 'resizing'>;
  children: ReactNode;
};

const mainColumnClass = (leaving: boolean, resizing: boolean) =>
  cn(
    'flex-1',
    leaving && cn('mr-[calc(var(--pane-gap)*-1)] transition-[margin]', SPRING),
    leaving || resizing
      ? 'min-w-0'
      : 'min-w-[min(var(--pane-min),calc(50%_-_var(--pane-gap)_/_2))]',
  );

const splitColumnClass = ({
  leaving,
  fills,
  focused,
  cramped,
  resizing,
  released,
}: Pick<
  PaneColumnProps,
  | 'leaving'
  | 'fills'
  | 'focused'
  | 'cramped'
  | 'resizing'
  | 'released'
>) =>
  cn(
    'max-w-[max(calc(100%_-_var(--pane-min)_-_var(--pane-gap)),calc(50%_-_var(--pane-gap)_/_2))] shrink-0',
    leaving && 'ml-[calc(var(--pane-gap)*-1)] w-0',
    fills && 'w-full max-w-none',
    !leaving && !fills && 'w-(--split-width)',
    focused &&
      (cramped ? 'w-full max-w-none' : 'max-md:w-full max-md:max-w-none'),
    !resizing &&
      cn(
        released
          ? 'transition-[width,max-width,margin]'
          : 'transition-[width,margin]',
        SPRING,
        'max-md:transition-none',
      ),
  );

const sectionWidthClass = (main: boolean, sliding: boolean) => {
  if (!main) {
    return 'md:min-w-(--pane-min)';
  }

  return sliding && 'min-w-(--pane-min)';
};

function PaneColumn({
  ref,
  section,
  leaving,
  fills,
  focused,
  folded,
  cramped,
  collapsing,
  resizing,
  released,
  handle,
  children,
}: PaneColumnProps) {
  const main = section === 'main';

  return (
    <div
      ref={ref}
      inert={leaving || undefined}
      className={cn(
        'relative flex flex-col',
        folded && (cramped ? 'hidden' : 'max-md:hidden'),
        leaving && !main && 'max-md:hidden',
        main
          ? mainColumnClass(leaving, resizing)
          : splitColumnClass({
              leaving,
              fills,
              focused,
              cramped,
              resizing,
              released,
            }),
      )}
    >
      {handle && (
        <PaneHandle
          {...handle}
          edge="left"
          resizing={resizing}
          className={cn(
            '-left-2 touch-none pointer-coarse:-left-4 pointer-coarse:w-6',
            cramped ? 'hidden' : 'max-md:hidden',
          )}
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
          data-slot="pane"
          tabIndex={-1}
          data-focused={(focused && !cramped) || undefined}
          data-collapsing={collapsing || undefined}
          className={cn(
            PANE_SECTION,
            SPRING,
            sectionWidthClass(main, leaving || resizing),
          )}
        >
          {children}
        </section>
      </div>
    </div>
  );
}

const PaneContent = memo(function PaneContent({
  defer,
  children,
}: {
  defer: boolean;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(!defer);

  useEffect(() => {
    if (!shown) {
      startTransition(() => setShown(true));
    }
  }, [shown]);

  return shown ? children : null;
});
