import { type MouseEvent, useState } from 'react';

const GAP = 6;

const CURSOR_HEIGHT = 16;

export type TipPlacement = { readonly left: boolean; readonly above: boolean };

type Pointer = TipPlacement & { readonly x: number; readonly y: number };

export function useCursorTooltip() {
  const [pointer, setPointer] = useState<Pointer | null>(null);

  return {
    area: {
      onMouseMove: (event: MouseEvent<HTMLElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - box.left;
        const y = event.clientY - box.top;
        const left = x > box.width / 2;
        const above = y > box.height / 2;

        setPointer({
          x: left ? x - GAP : x + GAP,
          y: above ? y - GAP : y + CURSOR_HEIGHT + GAP,
          left,
          above,
        });
      },
      onMouseLeave: () => setPointer(null),
    },
    tooltip: {
      position: pointer ? { x: pointer.x, y: pointer.y } : undefined,
      wrapperStyle: { zIndex: 50, pointerEvents: 'none' as const },
      isAnimationActive: false,
    },
    placement: {
      left: pointer?.left ?? false,
      above: pointer?.above ?? false,
    } satisfies TipPlacement,
  };
}
