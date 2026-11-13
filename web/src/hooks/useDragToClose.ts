import { type PointerEvent, type RefObject, useRef } from 'react';

type PaneHandlers = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
};

type DragToClose<Closing> = {
  width: number;
  direction: 1 | -1;
  paneRef: RefObject<HTMLElement | null>;
  handleProps: PaneHandlers;
  resize: (width: number) => void;
  closingAt: (wanted: number, room: number) => Closing | null;
  onClosing: (closing: Closing | null) => void;
  onClose: (closing: Closing) => void;
};

export function useDragToClose<Closing>({
  width,
  direction,
  paneRef,
  handleProps,
  resize,
  closingAt,
  onClosing,
  onClose,
}: DragToClose<Closing>): PaneHandlers {
  const origin = useRef<{ x: number; width: number } | null>(null);

  const wantedAt = (event: PointerEvent<HTMLElement>) =>
    origin.current
      ? origin.current.width + direction * (event.clientX - origin.current.x)
      : null;

  const closingFor = (event: PointerEvent<HTMLElement>) => {
    const wanted = wantedAt(event);
    const room = paneRef.current?.parentElement?.clientWidth || Infinity;

    return wanted === null ? null : closingAt(wanted, room);
  };

  const follow = (wanted: number | null) => {
    const pane = paneRef.current;
    if (pane) {
      pane.style.maxWidth = wanted === null ? '' : 'none';
      pane.style.width = `${wanted ?? width}px`;
    }
  };

  return {
    onPointerDown: (event) => {
      origin.current = { x: event.clientX, width };
      handleProps.onPointerDown(event);
    },
    onPointerMove: (event) => {
      handleProps.onPointerMove(event);
      const closing = closingFor(event);
      onClosing(closing);

      if (closing !== null) {
        follow(Math.max(0, wantedAt(event) ?? 0));
      } else if (paneRef.current) {
        paneRef.current.style.maxWidth = '';
      }
    },
    onPointerUp: (event) => {
      const closing = closingFor(event);
      const before = origin.current?.width ?? width;
      origin.current = null;
      handleProps.onPointerUp(event);
      onClosing(null);

      if (closing !== null) {
        resize(before);
        follow(null);
        onClose(closing);
      }
    },
  };
}
