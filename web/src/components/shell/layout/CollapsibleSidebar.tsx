import {
  type ReactNode,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { SidebarAside } from '@/components/shell/layout/SidebarAside';
import { SidebarExpand } from '@/components/shell/layout/SidebarExpand';
import { SidebarPeekLayer } from '@/components/shell/layout/SidebarPeekLayer';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { useCollapsedSidebar } from '@/hooks/useCollapsedSidebar';
import { useDragToClose } from '@/hooks/useDragToClose';
import { useNarrowViewport } from '@/hooks/useNarrowViewport';
import { usePaneWidth, WORKSPACE_SIDEBAR } from '@/hooks/usePaneWidth';
import { useSettling } from '@/hooks/useSettling';
import { useSidebarShortcut } from '@/hooks/useSidebarShortcut';
import { framesWindow } from '@/lib/desktop';
import { SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

const CLOSES_AT_PX = 96;

const FLING_PX_PER_MS = 0.5;

const FAST_FLING_PX_PER_MS = 0.8;

const FAST_FLING_TRAVEL_PX = 40;

const gutterWidthOf = (width: number) =>
  `max(var(--sidebar-floor), ${width}px)`;

type ToggleRoomProps = {
  touch: boolean;
  narrow: boolean;
  desktop: boolean;
  floating: boolean;
};

function ToggleRoom({ touch, narrow, desktop, floating }: ToggleRoomProps) {
  if (!touch || narrow || desktop) {
    return null;
  }

  return (
    <div
      aria-hidden
      data-slot="sidebar-toggle-room"
      className={cn(
        'shrink-0',
        floating ? 'h-0' : cn('h-7 transition-[height]', SPRING),
      )}
    />
  );
}

type ToggleFocusProps = {
  paneRef: RefObject<HTMLElement | null>;
  asideRef: RefObject<HTMLElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
  hidden: boolean;
  collapsed: boolean;
  pinned: boolean;
  desktop: boolean;
  touch: boolean;
  narrow: boolean;
};

function useToggleFocus({
  paneRef,
  asideRef,
  toggleRef,
  hidden,
  collapsed,
  pinned,
  desktop,
  touch,
  narrow,
}: ToggleFocusProps) {
  const restoreRef = useRef<HTMLElement | null>(null);
  const opened = !collapsed || pinned;
  const reachable = desktop || (touch && !narrow);

  useLayoutEffect(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return;
    }

    if (hidden && paneRef.current?.contains(active)) {
      restoreRef.current = active;
      toggleRef.current?.focus();
    } else if (opened && !reachable && active === toggleRef.current) {
      const aside = asideRef.current;
      const restore = restoreRef.current?.isConnected
        ? restoreRef.current
        : aside?.querySelector<HTMLElement>('a[href]');
      (restore ?? aside)?.focus();
    }
  }, [hidden, opened, reachable, paneRef, asideRef, toggleRef]);
}

type CollapsibleSidebarProps = {
  children?: ReactNode;
};

export function CollapsibleSidebar({ children }: CollapsibleSidebarProps) {
  const [closing, setClosing] = useState(false);
  const [leaving, setLeaving] = useSettling<true>();
  const asideRef = useRef<HTMLElement | null>(null);
  const pane = usePaneWidth<HTMLDivElement>({
    ...WORKSPACE_SIDEBAR,
    onDrag: (dragged) => {
      const aside = asideRef.current;
      if (aside?.parentElement) {
        aside.parentElement.style.width =
          dragged === null ? '' : gutterWidthOf(dragged);
        aside.style.width = dragged === null ? '' : `${dragged}px`;
      }
    },
  });
  const { width, min, resizing, handleProps, paneRef } = pane;
  const asideId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const narrow = useNarrowViewport();
  const {
    collapsed,
    peeking,
    floating,
    pinned,
    docking,
    toggling,
    setCollapsed,
    ...peek
  } = useCollapsedSidebar(asideRef, toggleRef, narrow);
  const hidden = collapsed && !peeking;
  const shrunk = leaving !== null && hidden && !floating;
  const desktop = framesWindow();
  const touch = useCoarsePointer();

  useToggleFocus({
    paneRef,
    asideRef,
    toggleRef,
    hidden,
    collapsed,
    pinned,
    desktop,
    touch,
    narrow,
  });

  useSidebarShortcut(() => setCollapsed(!collapsed), Boolean(children));

  const closes = (wanted: number, velocity: number) =>
    wanted < CLOSES_AT_PX ||
    (wanted < min && velocity < -FLING_PX_PER_MS) ||
    (wanted < width - FAST_FLING_TRAVEL_PX && velocity < -FAST_FLING_PX_PER_MS);

  const dragHandle = useDragToClose({
    pane,
    direction: 1,
    follow: (wanted) => {
      const gutter = paneRef.current;
      const aside = asideRef.current;
      if (!gutter || !aside) {
        return;
      }

      aside.style.translate =
        wanted === null ? '' : `${Math.min(0, wanted - min)}px`;
      if (wanted !== null) {
        gutter.style.width = gutterWidthOf(wanted);
      }
    },
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
      {children && (
        <SidebarPeekLayer
          collapsed={collapsed}
          docking={docking}
          peeking={peeking}
          peekIntent={peek.peekIntent}
          onUnpeek={peek.unpeek}
        />
      )}

      <div
        ref={paneRef}
        data-slot="sidebar-gutter"
        className={cn(
          'relative shrink-0 max-md:w-0',
          collapsed
            ? 'w-2'
            : 'w-[max(var(--sidebar-floor),var(--sidebar-width))]',
          ((collapsed && !floating) || (toggling && !docking)) &&
            'overflow-hidden',
          !resizing && cn('transition-[width] max-md:transition-none', SPRING),
        )}
      >
        <SidebarAside
          ref={asideRef}
          id={asideId}
          collapsed={collapsed}
          peeking={peeking}
          floating={floating}
          docking={docking}
          resizing={resizing}
          regrowing={leaving !== null && !collapsed}
          closing={closing}
          shrunkTo={shrunk ? min : undefined}
          desktop={desktop}
        >
          <ToggleRoom
            touch={touch}
            narrow={narrow}
            desktop={desktop}
            floating={floating}
          />
          {children}
        </SidebarAside>

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
          className={cn(
            'touch-none pointer-coarse:-right-3 pointer-coarse:w-6',
            collapsed && 'hidden',
          )}
        />
      </div>

      <SidebarExpand
        toggleRef={toggleRef}
        controls={asideId}
        collapsed={collapsed}
        peeking={peeking}
        narrow={narrow}
        desktop={desktop}
        coarse={touch}
        disabled={!children}
        peekIntent={peek.peekIntent}
        onToggle={() => {
          if (!narrow) {
            setCollapsed(!collapsed);
          } else if (peeking) {
            peek.unpeek();
          } else {
            peek.pin();
          }
        }}
      />
    </>
  );
}
