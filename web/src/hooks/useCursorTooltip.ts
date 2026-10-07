import { type MouseEvent, useState } from 'react';

const GAP = 6;

const CURSOR_HEIGHT = 16;

export type TipPlacement = { readonly left: boolean; readonly above: boolean };

type Pointer = TipPlacement & { readonly x: number; readonly y: number };

export function useCursorTooltip({ floating = false } = {}) {
  const [pointer, setPointer] = useState<Pointer | null>(null);

  return {
    area: {
      onMouseMove: (event: MouseEvent<HTMLElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - box.left;
        const y = event.clientY - box.top;
        const left = floating
          ? event.clientX > window.innerWidth / 2
          : x > box.width / 2;
        const above = floating
          ? event.clientY > window.innerHeight / 2
          : y > box.height / 2;
        const at = floating ? { x: event.clientX, y: event.clientY } : { x, y };

        setPointer({
          x: left ? at.x - GAP : at.x + GAP,
          y: above ? at.y - GAP : at.y + CURSOR_HEIGHT + GAP,
          left,
          above,
        });
      },
      onMouseLeave: () => setPointer(null),
    },
    tooltip: {
      position: pointer ? { x: pointer.x, y: pointer.y } : undefined,
      wrapperStyle: {
        zIndex: 50,
        pointerEvents: 'none' as const,
        ...(floating && {
          position: 'fixed' as const,
          top: pointer?.y ?? 0,
          left: pointer?.x ?? 0,
        }),
      },
      ...(floating && { portal: document.body }),
      isAnimationActive: false,
    },
    placement: {
      left: pointer?.left ?? false,
      above: pointer?.above ?? false,
    } satisfies TipPlacement,
  };
}
