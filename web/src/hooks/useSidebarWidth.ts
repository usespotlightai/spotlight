import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';

const MIN_WIDTH = 192;
const MAX_WIDTH = 320;
const DEFAULT_WIDTH = 224;
const KEYBOARD_STEP = 16;
const STORAGE_KEY = 'spotlight.sidebar-width';

const clamp = (width: number) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));

const readStoredWidth = (): number => {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved > 0 ? clamp(saved) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
};

const remember = (width: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    // a browser that refuses storage still resizes, it just forgets
  }
};

export function useSidebarWidth() {
  const [width, setWidth] = useState(readStoredWidth);
  const [resizing, setResizing] = useState(false);
  const origin = useRef<{ x: number; width: number } | null>(null);

  const resize = (next: number) => {
    const clamped = clamp(next);
    setWidth(clamped);
    remember(clamped);
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
    resize(origin.current.width + event.clientX - origin.current.x);
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    origin.current = null;
    setResizing(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      resize(width - KEYBOARD_STEP);
    } else if (event.key === 'ArrowRight') {
      resize(width + KEYBOARD_STEP);
    } else if (event.key === 'Home') {
      resize(DEFAULT_WIDTH);
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
      'aria-label': 'Resize sidebar',
      'aria-valuenow': width,
      'aria-valuemin': MIN_WIDTH,
      'aria-valuemax': MAX_WIDTH,
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onKeyDown,
      onDoubleClick: () => resize(DEFAULT_WIDTH),
    },
  };
}
