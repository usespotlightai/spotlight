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
  edge?: 'left' | 'right';
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

const store = (pane: Pane, width: number) => {
  try {
    localStorage.setItem(pane.storageKey, String(width));
  } catch {}
};

export function usePaneWidth<T extends HTMLElement = HTMLElement>(
  pane: Pane = WORKSPACE_SIDEBAR,
) {
  const direction = pane.edge === 'left' ? -1 : 1;
  const [width, setWidth] = useState(() => readStoredWidth(pane));
  const [resizing, setResizing] = useState(false);
  const origin = useRef<{ x: number; width: number } | null>(null);
  const last = useRef(width);
  const paneRef = useRef<T | null>(null);

  useEffect(() => {
    if (!resizing) {
      return;
    }

    document.body.classList.add('resizing');
    return () => document.body.classList.remove('resizing');
  }, [resizing]);

  const resize = (next: number, persist = true) => {
    const clamped = clampTo(pane, next);
    last.current = clamped;
    setWidth(clamped);

    if (persist) {
      store(pane, clamped);
    }
  };

  const show = (next: number) => {
    const clamped = clampTo(pane, next);
    last.current = clamped;

    if (pane.property) {
      paneRef.current?.style.setProperty(pane.property, `${clamped}px`);
    } else if (paneRef.current) {
      paneRef.current.style.width = `${clamped}px`;
    } else {
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
    show(origin.current.width + direction * (event.clientX - origin.current.x));
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    origin.current = null;
    setResizing(false);
    setWidth(last.current);
    store(pane, last.current);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      resize(width - direction * KEYBOARD_STEP);
    } else if (event.key === 'ArrowRight') {
      resize(width + direction * KEYBOARD_STEP);
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
    paneRef,
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
