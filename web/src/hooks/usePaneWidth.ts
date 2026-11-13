import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

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
  property: '--sidebar-width',
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

const limitOf = (pane: Element | null | undefined) =>
  (pane && Number.parseFloat(getComputedStyle(pane).maxWidth)) || Infinity;

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
  const origin = useRef<{ x: number; width: number; limit: number } | null>(
    null,
  );
  const last = useRef(width);
  const paneRef = useRef<T | null>(null);

  useLayoutEffect(() => {
    if (pane.property && !resizing) {
      paneRef.current?.style.setProperty(pane.property, `${width}px`);
    }
  }, [pane.property, width, resizing]);

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
    if (event.button !== 0) {
      return;
    }

    const shown = event.currentTarget.parentElement;
    origin.current = {
      x: event.clientX,
      width: shown?.offsetWidth || width,
      limit: limitOf(shown),
    };
    setResizing(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const wantedAt = (event: PointerEvent<HTMLElement>) =>
    origin.current
      ? origin.current.width + direction * (event.clientX - origin.current.x)
      : null;

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const wanted = wantedAt(event);
    if (wanted !== null) {
      show(wanted);
    }
  };

  const finish = () => {
    if (!origin.current) {
      return;
    }

    const kept = Math.min(last.current, origin.current.limit);
    const keeps = kept >= pane.min;
    origin.current = null;
    last.current = keeps ? kept : width;
    flushSync(() => {
      setResizing(false);
      setWidth(last.current);
    });

    if (keeps) {
      store(pane, kept);
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    finish();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const step = (event: KeyboardEvent<HTMLElement>, by: number) => {
    const limit = limitOf(event.currentTarget?.parentElement);
    const shown = Math.min(width, limit);
    const next = Math.min(clampTo(pane, shown + by), Math.max(limit, pane.min));

    if (Math.min(next, limit) !== shown) {
      resize(next);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      step(event, -direction * KEYBOARD_STEP);
    } else if (event.key === 'ArrowRight') {
      step(event, direction * KEYBOARD_STEP);
    } else if (event.key === 'Home') {
      resize(pane.initial);
    } else {
      return;
    }
    event.preventDefault();
  };

  return {
    width,
    min: pane.min,
    resizing,
    wantedAt,
    limit: () => origin.current?.limit ?? null,
    paneRef,
    resize,
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
      onLostPointerCapture: finish,
      onKeyDown,
      onDoubleClick: () => resize(pane.initial),
    },
  };
}
