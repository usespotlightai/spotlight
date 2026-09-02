import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';

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

export function usePaneWidth(pane: Pane = WORKSPACE_SIDEBAR) {
  const towards = pane.edge === 'left' ? -1 : 1;
  const [width, setWidth] = useState(() => readStoredWidth(pane));
  const [resizing, setResizing] = useState(false);
  const origin = useRef<{ x: number; width: number } | null>(null);
  const last = useRef(width);

  /**
   * Storage is written when the handle is let go, not on every pixel it
   * passes through: a drag is hundreds of moves, and each one was a
   * synchronous write.
   */
  const resize = (next: number, keep = true) => {
    const clamped = clampTo(pane, next);
    last.current = clamped;
    setWidth(clamped);

    if (keep) {
      remember(pane, clamped);
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
    resize(
      origin.current.width + towards * (event.clientX - origin.current.x),
      false,
    );
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    origin.current = null;
    setResizing(false);
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
