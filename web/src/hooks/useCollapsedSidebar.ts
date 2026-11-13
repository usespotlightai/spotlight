import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
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

export const useSidebarCollapsedSetting = () =>
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
  const [toggling, setToggling] = useSettling<true>();
  const [, settleFloating] = useSettling<true>(() => setFloating(false));
  const intent = useRef<ReturnType<typeof setTimeout>>(undefined);
  const armed = useRef(true);

  const unpeek = useCallback(() => {
    armed.current = false;
    setPeeking(false);
    settleFloating(true);
  }, [settleFloating]);

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
      timer ??= setTimeout(unpeek, PEEK_LEAVE_DELAY_MS);
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
        unpeek();
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
  }, [collapsed, peeking, paneRef, triggerRef, unpeek]);

  const peek = () => {
    settleFloating(null);
    setFloating(true);
    setPeeking(true);
  };

  return {
    collapsed,
    peeking: collapsed && peeking,
    floating: collapsed && floating,
    docking: docking !== null,
    toggling: toggling !== null,
    unpeek,
    setCollapsed: (next: boolean) => {
      if (next) {
        armed.current = false;
      } else if (peeking || floating) {
        setDocking(true);
      }
      setToggling(true);
      store(String(next));
      setPeeking(false);
      setFloating(false);
      settleFloating(null);
    },
    peekIntent: {
      onPointerEnter: (event: ReactPointerEvent) => {
        clearTimeout(intent.current);
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
