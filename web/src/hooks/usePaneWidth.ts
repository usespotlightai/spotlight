import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

const KEYBOARD_STEP = 16;

type Pane = {
  storageKey: string;
  min: number;
  max: number;
  initial: number;
  label: string;
  /**
   * Which side of the pane the handle sits on. Dragging it away from the pane
   * widens it, whichever side that is.
   */
  edge?: 'left' | 'right';
  /**
   * The custom property the pane's width is drawn from. A drag writes it
   * straight onto the element, so the width follows the pointer without
   * waiting on a render of whatever the pane is holding.
   */
  property?: string;
};

const WORKSPACE_SIDEBAR: Pane = {
  storageKey: 'spotlight.sidebar-width',
  min: 192,
  max: 320,
  initial: 224,
  label: 'Resize sidebar',
};

const readStoredWidth = (pane: Pane): number => {
  try {
    const saved = Number(localStorage.getItem(pane.storageKey));
    return saved > 0 ? clampTo(pane, saved) : pane.initial;
  } catch {
    return pane.initial;
  }
};

const clampTo = (pane: Pane, width: number) =>
  Math.min(pane.max, Math.max(pane.min, Math.round(width)));

const remember = (pane: Pane, width: number) => {
  try {
    localStorage.setItem(pane.storageKey, String(width));
  } catch {
    // a browser that refuses storage still resizes, it just forgets
  }
};

export function usePaneWidth<T extends HTMLElement = HTMLElement>(
  pane: Pane = WORKSPACE_SIDEBAR,
) {
  const towards = pane.edge === 'left' ? -1 : 1;
  const [width, setWidth] = useState(() => readStoredWidth(pane));
  const [resizing, setResizing] = useState(false);
  const origin = useRef<{ x: number; width: number } | null>(null);
  const last = useRef(width);
  const held = useRef<T | null>(null);

  /**
   * Storage is written when the handle is let go, not on every pixel it
   * passes through: a drag is hundreds of moves, and each one was a
   * synchronous write.
   */
  // Held on the document, because the pointer spends the drag over whatever
  // else is on the page: without it the cursor flickers back to a caret and
  // the text under it starts selecting.
  useEffect(() => {
    if (!resizing) {
      return;
    }

    document.body.classList.add('resizing');
    return () => document.body.classList.remove('resizing');
  }, [resizing]);

  const resize = (next: number, keep = true) => {
    const clamped = clampTo(pane, next);
    last.current = clamped;
    setWidth(clamped);

    if (keep) {
      remember(pane, clamped);
    }
  };

  /**
   * Straight to the element, so the pointer is never waited on by React. A
   * pane that hands its width to others writes the property they read; one
   * that only sizes itself writes its own width.
   */
  const show = (next: number) => {
    const clamped = clampTo(pane, next);
    last.current = clamped;

    if (pane.property) {
      held.current?.style.setProperty(pane.property, `${clamped}px`);
    } else if (held.current) {
      held.current.style.width = `${clamped}px`;
    } else {
      // No element was handed over, so there is nothing to write to and React
      // has to carry the drag.
      setWidth(clamped);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    origin.current = { x: event.clientX, width };
    setResizing(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!origin.current) {
      return;
    }
    show(origin.current.width + towards * (event.clientX - origin.current.x));
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    origin.current = null;
    setResizing(false);
    // What the element has been showing all along becomes what React holds.
    setWidth(last.current);
    remember(pane, last.current);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      resize(width - towards * KEYBOARD_STEP);
    } else if (event.key === 'ArrowRight') {
      resize(width + towards * KEYBOARD_STEP);
    } else if (event.key === 'Home') {
      resize(pane.initial);
    } else {
      return;
    }
    event.preventDefault();
  };

  return {
    width,
    resizing,
    /** Put on whatever element carries the width. */
    paneRef: held,
    handleProps: {
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-label': pane.label,
      'aria-valuenow': width,
      'aria-valuemin': pane.min,
      'aria-valuemax': pane.max,
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onKeyDown,
      onDoubleClick: () => resize(pane.initial),
    },
  };
}
