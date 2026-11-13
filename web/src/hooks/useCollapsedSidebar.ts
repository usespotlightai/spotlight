import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useSettling } from '@/hooks/useSettling';
import { useStoredState } from '@/hooks/useStoredState';

const SIDEBAR_COLLAPSED_KEY = 'spotlight.sidebar-collapsed';

const PEEK_LEAVE_DELAY_MS = 300;

const PEEK_INTENT_DELAY_MS = 75;

const PEEK_ARMS_PAST_PX = 24;

type Box = { left: number; top: number; width: number; height: number };

const inside = (box: Box, { clientX, clientY }: PointerEvent) =>
  clientX >= box.left &&
  clientX <= box.left + box.width &&
  clientY >= box.top &&
  clientY <= box.top + box.height;

const layoutBox = (element: HTMLElement): Box => ({
  left: element.offsetLeft,
  top: element.offsetTop,
  width: element.offsetWidth,
  height: element.offsetHeight,
});

export const useSidebarCollapsed = () =>
  useStoredState(SIDEBAR_COLLAPSED_KEY, 'false')[0] === 'true';

export function useCollapsedSidebar(
  paneRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
) {
  const [stored, store] = useStoredState(SIDEBAR_COLLAPSED_KEY, 'false');
  const collapsed = stored === 'true';
  const [peeking, setPeeking] = useState(false);
  const [floating, setFloating] = useState(false);
  const [docking, setDocking] = useSettling<true>();
  const intent = useRef<ReturnType<typeof setTimeout>>(undefined);
  const armed = useRef(true);

  useEffect(() => () => clearTimeout(intent.current), [collapsed]);

  useEffect(() => {
    if (!collapsed || peeking) {
      return;
    }

    const moved = (event: PointerEvent) => {
      const trigger = triggerRef.current;
      armed.current ||=
        event.clientX > PEEK_ARMS_PAST_PX &&
        !(trigger && inside(trigger.getBoundingClientRect(), event));
    };
    document.addEventListener('pointermove', moved);

    return () => document.removeEventListener('pointermove', moved);
  }, [collapsed, peeking, triggerRef]);

  useEffect(() => {
    if (!collapsed || !peeking) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const leaveSoon = () => {
      timer ??= setTimeout(() => setPeeking(false), PEEK_LEAVE_DELAY_MS);
    };
    const moved = (event: PointerEvent) => {
      const pane = paneRef.current;
      const trigger = triggerRef.current;
      const held =
        !pane ||
        inside(layoutBox(pane), event) ||
        (trigger !== null && inside(trigger.getBoundingClientRect(), event)) ||
        pane.querySelector('[data-popup-open], :focus-visible') !== null;

      if (held) {
        clearTimeout(timer);
        timer = undefined;
      } else {
        leaveSoon();
      }
    };
    const left = (event: PointerEvent) => {
      if (event.relatedTarget === null) {
        leaveSoon();
      }
    };
    const escaped = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !paneRef.current?.querySelector('[data-popup-open]')
      ) {
        setPeeking(false);
      }
    };
    document.addEventListener('pointermove', moved);
    document.addEventListener('pointerout', left);
    document.addEventListener('keydown', escaped);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointermove', moved);
      document.removeEventListener('pointerout', left);
      document.removeEventListener('keydown', escaped);
    };
  }, [collapsed, peeking, paneRef, triggerRef]);

  const peek = () => {
    setFloating(true);
    setPeeking(true);
  };

  return {
    collapsed,
    peeking: collapsed && peeking,
    floating: collapsed && floating,
    docking: docking !== null,
    unpeek: () => setPeeking(false),
    setCollapsed: (next: boolean) => {
      if (next) {
        armed.current = false;
      } else if (peeking) {
        setDocking(true);
      }
      store(String(next));
      setPeeking(false);
      setFloating(false);
    },
    peekIntent: {
      onPointerEnter: (event: ReactPointerEvent) => {
        if (collapsed && armed.current && event.buttons === 0) {
          intent.current = setTimeout(peek, PEEK_INTENT_DELAY_MS);
        }
      },
      onPointerLeave: () => {
        clearTimeout(intent.current);
        armed.current = true;
      },
    },
  };
}
