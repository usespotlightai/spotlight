import {
  type CSSProperties,
  type RefObject,
  useLayoutEffect,
  useState,
} from 'react';

const FADE = '1.5rem';

type Edges = { readonly start: boolean; readonly end: boolean };

const NONE: Edges = { start: false, end: false };

const fadeOf = ({ start, end }: Edges): CSSProperties | undefined => {
  if (!start && !end) {
    return undefined;
  }

  const mask = `linear-gradient(to right, ${start ? 'transparent' : 'black'}, black ${FADE}, black calc(100% - ${FADE}), ${end ? 'transparent' : 'black'})`;

  return { maskImage: mask, WebkitMaskImage: mask };
};

export function useTabStrip(
  strip: RefObject<HTMLElement | null>,
  current: string,
): CSSProperties | undefined {
  const [edges, setEdges] = useState<Edges>(NONE);

  useLayoutEffect(() => {
    strip.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [strip, current]);

  useLayoutEffect(() => {
    const element = strip.current;

    if (!element) {
      return;
    }

    const measure = () => {
      const hidden = element.scrollWidth - element.clientWidth;
      const start = hidden > 1 && element.scrollLeft > 1;
      const end = hidden > 1 && element.scrollLeft < hidden - 1;

      setEdges((was) =>
        was.start === start && was.end === end ? was : { start, end },
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) {
      observer.observe(child);
    }
    element.addEventListener('scroll', measure, { passive: true });

    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, [strip]);

  return fadeOf(edges);
}
