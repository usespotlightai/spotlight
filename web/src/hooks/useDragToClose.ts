import { type PointerEvent, type RefObject, useRef } from 'react';

const VELOCITY_WINDOW_MS = 80;

const MIN_VELOCITY_SPAN_MS = 10;

type PaneHandlers = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: () => void;
};

type DragToClose<Closing> = {
  width: number;
  min: number;
  max?: (room: number) => number;
  direction: 1 | -1;
  paneRef: RefObject<HTMLElement | null>;
  property: string;
  handleProps: PaneHandlers;
  resize: (width: number) => void;
  closingAt: (wanted: number, room: number, velocity: number) => Closing | null;
  onClosing: (closing: Closing | null) => void;
  onClose: (closing: Closing) => void;
};

type Sample = { x: number; at: number };

export function useDragToClose<Closing>({
  width,
  min,
  max = () => Infinity,
  direction,
  paneRef,
  property,
  handleProps,
  resize,
  closingAt,
  onClosing,
  onClose,
}: DragToClose<Closing>): PaneHandlers {
  const origin = useRef<{ x: number; width: number } | null>(null);
  const samples = useRef<Sample[]>([]);

  const wantedAt = (event: PointerEvent<HTMLElement>) =>
    origin.current
      ? origin.current.width + direction * (event.clientX - origin.current.x)
      : null;

  const room = () => paneRef.current?.parentElement?.clientWidth || Infinity;

  const track = (event: PointerEvent<HTMLElement>) => {
    const at = Date.now();
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

  const follow = (wanted: number | null) => {
    if (wanted === null) {
      paneRef.current?.style.removeProperty(property);
    } else {
      paneRef.current?.style.setProperty(property, `${wanted}px`);
    }
  };

  const end = () => {
    origin.current = null;
    samples.current = [];
    follow(null);
    onClosing(null);
  };

  return {
    onPointerDown: (event) => {
      origin.current = { x: event.clientX, width };
      samples.current = [];
      track(event);
      handleProps.onPointerDown(event);
    },
    onPointerMove: (event) => {
      handleProps.onPointerMove(event);
      const wanted = wantedAt(event);
      if (wanted === null) {
        return;
      }

      track(event);
      const closing = closingAt(wanted, room(), 0);
      onClosing(closing);
      follow(
        closing !== null || wanted < min || wanted > max(room())
          ? wanted
          : null,
      );
    },
    onPointerUp: (event) => {
      const wanted = wantedAt(event);
      const closing =
        wanted === null ? null : closingAt(wanted, room(), track(event));
      const before = origin.current?.width ?? width;
      end();
      handleProps.onPointerUp(event);

      if (closing !== null) {
        resize(before);
        onClose(closing);
      }
    },
    onLostPointerCapture: () => {
      const before = origin.current?.width;
      handleProps.onLostPointerCapture();

      if (before !== undefined) {
        end();
        resize(before);
      }
    },
  };
}
