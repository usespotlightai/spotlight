import { type PointerEvent, useRef } from 'react';

import type { usePaneWidth } from '@/hooks/usePaneWidth';

const VELOCITY_WINDOW_MS = 80;

const MIN_VELOCITY_SPAN_MS = 10;

type PaneHandlers = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: () => void;
};

type DragToClose<Closing> = {
  pane: ReturnType<typeof usePaneWidth>;
  direction: 1 | -1;
  room?: () => number;
  follow: (wanted: number | null) => void;
  closingAt: (wanted: number, room: number, velocity: number) => Closing | null;
  onClosing: (closing: Closing | null) => void;
  onClose: (closing: Closing) => void;
};

type Sample = { x: number; at: number };

export function useDragToClose<Closing>({
  pane,
  direction,
  room = () => Infinity,
  follow,
  closingAt,
  onClosing,
  onClose,
}: DragToClose<Closing>): PaneHandlers {
  const { width, min, handleProps, wantedAt, limit, resize } = pane;
  const samples = useRef<Sample[]>([]);
  const roomAtStart = useRef(Infinity);
  const shownClosing = useRef<Closing | null>(null);

  const track = (event: PointerEvent<HTMLElement>) => {
    const at = event.timeStamp;
    samples.current = [
      ...samples.current.filter(
        (sample) => at - sample.at <= VELOCITY_WINDOW_MS,
      ),
      { x: event.clientX, at },
    ];
    const [first] = samples.current;
    const elapsed = at - first.at;

    return elapsed >= MIN_VELOCITY_SPAN_MS
      ? (direction * (event.clientX - first.x)) / elapsed
      : 0;
  };

  const end = () => {
    samples.current = [];
    shownClosing.current = null;
    follow(null);
    onClosing(null);
  };

  return {
    onPointerDown: (event) => {
      if (event.button !== 0) {
        return;
      }

      samples.current = [];
      roomAtStart.current = room() || Infinity;
      track(event);
      handleProps.onPointerDown(event);
    },
    onPointerMove: (event) => {
      const wanted = wantedAt(event);
      handleProps.onPointerMove(event);
      if (wanted === null) {
        return;
      }

      track(event);
      const closing = closingAt(wanted, roomAtStart.current, 0);
      shownClosing.current = closing;
      onClosing(closing);
      follow(
        closing !== null || wanted < min || wanted > (limit() ?? Infinity)
          ? wanted
          : null,
      );
    },
    onPointerUp: (event) => {
      const wanted = wantedAt(event);
      const closing =
        wanted === null
          ? null
          : closingAt(wanted, roomAtStart.current, track(event));
      handleProps.onPointerUp(event);

      if (wanted === null) {
        return;
      }

      end();
      if (closing !== null) {
        resize(width);
        onClose(closing);
      }
    },
    onLostPointerCapture: () => {
      const dragged = limit() !== null;
      const closing = shownClosing.current;
      handleProps.onLostPointerCapture();

      if (dragged) {
        end();
        resize(width);
        if (closing !== null) {
          onClose(closing);
        }
      }
    },
  };
}
