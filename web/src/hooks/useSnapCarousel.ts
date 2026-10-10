import {
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const FLICK = 40;
const QUIET = 120;

const prefersLessMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const stopsOf = (track: HTMLElement): number[] => {
  const slides = [...track.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  const start = slides[0]?.offsetLeft ?? 0;
  const furthest = Math.round(
    Math.max(track.scrollWidth - track.clientWidth, 0),
  );
  const near = (slides[0]?.offsetWidth ?? 0) / 2;
  const lefts = slides
    .map((slide) => Math.round(slide.offsetLeft - start))
    .filter((left) => left === 0 || left < furthest - near);

  return [...new Set([...lefts, furthest])];
};

const nearestStop = (stops: readonly number[], left: number): number =>
  stops.reduce(
    (best, stop, place) =>
      Math.abs(stop - left) < Math.abs((stops[best] ?? 0) - left)
        ? place
        : best,
    0,
  );

type Drag = {
  readonly x: number;
  readonly left: number;
  readonly from: number;
};

export function useSnapCarousel(count: number) {
  const track = useRef<HTMLUListElement>(null);
  const drag = useRef<Drag | null>(null);
  const quiet = useRef<number | undefined>(undefined);
  const [stops, setStops] = useState<readonly number[]>([0]);
  const [at, setAt] = useState(0);
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const element = track.current;

    if (!element || count === 0) {
      return;
    }

    const measure = () => {
      const next = stopsOf(element);
      setStops(next);
      setAt(nearestStop(next, element.scrollLeft));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [count]);

  useEffect(() => () => window.clearTimeout(quiet.current), []);

  const settle = useCallback(() => {
    const element = track.current;
    if (!element || drag.current) {
      return;
    }
    const target = stops[nearestStop(stops, element.scrollLeft)] ?? 0;
    if (Math.abs(target - element.scrollLeft) > 1) {
      element.scrollTo?.({
        left: target,
        behavior: prefersLessMotion() ? 'auto' : 'smooth',
      });
    }
  }, [stops]);

  const onScroll = useCallback(() => {
    const element = track.current;
    if (!element) {
      return;
    }
    window.clearTimeout(quiet.current);
    quiet.current = window.setTimeout(settle, QUIET);
    if (!drag.current) {
      setAt(nearestStop(stops, element.scrollLeft));
    }
  }, [settle, stops]);

  const go = useCallback(
    (to: number) => {
      const next = Math.min(Math.max(to, 0), stops.length - 1);
      setAt(next);
      track.current?.scrollTo?.({
        left: stops[next] ?? 0,
        behavior: prefersLessMotion() ? 'auto' : 'smooth',
      });
    },
    [stops],
  );

  const pages = stops.length;

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const element = track.current;
      if (
        !element ||
        pages < 2 ||
        event.pointerType !== 'mouse' ||
        event.button !== 0
      ) {
        return;
      }
      element.setPointerCapture(event.pointerId);
      drag.current = {
        x: event.clientX,
        left: element.scrollLeft,
        from: nearestStop(stops, element.scrollLeft),
      };
      setDragging(true);
    },
    [pages, stops],
  );

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const element = track.current;
    const held = drag.current;
    if (element && held) {
      element.scrollLeft = held.left - (event.clientX - held.x);
    }
  }, []);

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const element = track.current;
      const held = drag.current;
      if (!element || !held) {
        return;
      }
      drag.current = null;
      setDragging(false);
      element.releasePointerCapture(event.pointerId);

      const moved = event.clientX - held.x;
      const nearest = nearestStop(stops, element.scrollLeft);
      go(
        nearest === held.from && Math.abs(moved) > FLICK
          ? held.from + (moved < 0 ? 1 : -1)
          : nearest,
      );
    },
    [go, stops],
  );

  return {
    track,
    at,
    pages,
    dragging,
    go,
    onScroll,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
