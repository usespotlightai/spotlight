import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { SidebarToggle } from '@/components/shell/layout/SidebarToggle';
import { useCollapsedSidebar } from '@/hooks/useCollapsedSidebar';
import { useDragToClose } from '@/hooks/useDragToClose';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { useSettling } from '@/hooks/useSettling';
import { useSidebarShortcut } from '@/hooks/useSidebarShortcut';
import { framesWindow } from '@/lib/desktop';
import { SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

const CLOSES_AT_PX = 96;

const FLING_PX_PER_MS = 0.5;

const FAST_FLING_PX_PER_MS = 0.8;

const FAST_FLING_TRAVEL_PX = 40;

type CollapsibleSidebarProps = {
  children?: ReactNode;
};

export function CollapsibleSidebar({ children }: CollapsibleSidebarProps) {
  const [closing, setClosing] = useState(false);
  const [leaving, setLeaving] = useSettling<true>();
  const { width, min, resizing, handleProps, paneRef, resize } =
    usePaneWidth<HTMLDivElement>();
  const asideId = useId();
  const asideRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const { collapsed, peeking, floating, docking, setCollapsed, ...peek } =
    useCollapsedSidebar(asideRef, toggleRef);
  const hidden = collapsed && !peeking;
  const shrunk = leaving !== null && hidden && !floating;
  const desktop = framesWindow();

  useLayoutEffect(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !active.closest('[inert]')) {
      return;
    }

    const aside = asideRef.current;
    if (collapsed || desktop) {
      if (aside?.contains(active)) {
        restoreRef.current = active;
      }
      toggleRef.current?.focus();
    } else {
      const restore = restoreRef.current?.isConnected
        ? restoreRef.current
        : aside?.querySelector<HTMLElement>('a[href]');
      (restore ?? aside)?.focus();
    }
  }, [collapsed, hidden, desktop]);

  useSidebarShortcut(() => setCollapsed(!collapsed));

  const closes = (wanted: number, velocity: number) =>
    wanted < CLOSES_AT_PX ||
    (wanted < min && velocity < -FLING_PX_PER_MS) ||
    (wanted < width - FAST_FLING_TRAVEL_PX && velocity < -FAST_FLING_PX_PER_MS);

  const dragHandle = useDragToClose({
    width,
    min,
    direction: 1,
    paneRef,
    property: '--sidebar-drag',
    handleProps,
    resize,
    closingAt: (wanted, _room, velocity) =>
      closes(wanted, velocity) ? true : null,
    onClosing: (closing) => setClosing(closing ?? false),
    onClose: () => {
      setLeaving(true);
      setCollapsed(true);
    },
  });

  return (
    <>
      <div
        aria-hidden
        data-slot="sidebar-backdrop"
        onClick={peek.unpeek}
        className={cn(
          'fixed inset-0 z-40 hidden bg-black/10 transition-opacity supports-backdrop-filter:backdrop-blur-xs md:block',
          SPRING,
          peeking ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {collapsed && (
        <div
          aria-hidden
          data-slot="sidebar-peek"
          {...peek.peekIntent}
          className="fixed top-11 bottom-0 left-0 z-40 hidden w-2 md:block"
        />
      )}

      <div
        ref={paneRef}
        data-slot="sidebar-gutter"
        data-resizing={resizing || undefined}
        className={cn(
          'relative hidden shrink-0 md:block',
          collapsed
            ? 'w-2'
            : 'w-[max(0.5rem,var(--sidebar-drag,var(--sidebar-width)))]',
          collapsed && !floating && 'overflow-hidden',
          !resizing && cn('transition-[width]', SPRING),
        )}
      >
        <aside
          ref={asideRef}
          id={asideId}
          tabIndex={-1}
          inert={hidden || undefined}
          data-collapsed={collapsed || undefined}
          data-peeking={peeking || undefined}
          data-floating={floating || undefined}
          data-closing={closing || shrunk || undefined}
          style={shrunk ? { width: min } : undefined}
          className={cn(
            'left-0 flex flex-col overflow-hidden border-[0.5px] border-l-0 px-3 py-2 outline-none data-closing:opacity-40',
            SPRING,
            floating
              ? 'fixed top-11 bottom-2 z-50 w-[max(var(--sidebar-width),14rem)] rounded-r-xl border-border bg-background shadow-overlay transition-[translate,opacity]'
              : 'absolute inset-y-0 z-10 w-(--sidebar-width) translate-x-[calc(var(--sidebar-drag,var(--sidebar-width))-var(--sidebar-width))] border-transparent transition-[background-color,translate,opacity,width,top,bottom,border-color,border-radius,box-shadow] [transition-delay:200ms,0s,0s,0s,0s,0s,0s,0s,0s]',
            docking && 'z-50',
            !desktop && 'bg-background',
            resizing && 'transition-opacity [transition-delay:0s]',
            hidden &&
              cn(
                'pointer-events-none',
                floating
                  ? '-translate-x-[calc(100%+3rem)]'
                  : '-translate-x-full',
              ),
          )}
        >
          {desktop && (
            <div
              data-slot="window-buttons"
              className={cn(
                'shrink-0',
                floating ? 'h-0' : cn('h-7 transition-[height]', SPRING),
              )}
            />
          )}
          {children}
        </aside>

        <PaneHandle
          {...handleProps}
          {...dragHandle}
          inert={collapsed || undefined}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              setCollapsed(true);
            } else {
              handleProps.onKeyDown(event);
            }
          }}
          edge="right"
          resizing={resizing}
          className={cn(collapsed && 'hidden')}
        />
      </div>

      {children && (
        <div
          data-slot="sidebar-expand"
          inert={(!collapsed && !desktop) || undefined}
          {...peek.peekIntent}
          className={cn(
            'fixed top-2 z-50 hidden md:block',
            desktop ? 'left-20' : 'left-2',
            !desktop &&
              (collapsed
                ? cn('transition-[opacity,translate]', SPRING)
                : 'pointer-events-none -translate-x-2 opacity-0'),
          )}
        >
          <SidebarToggle
            ref={toggleRef}
            collapsed={collapsed}
            controls={asideId}
            onToggle={() => setCollapsed(!collapsed)}
          />
        </div>
      )}
    </>
  );
}
