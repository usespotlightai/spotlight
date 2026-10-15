import { useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import type { Written } from '@/lib/chat-input';

const ONE_LINE = 30;

const FIT_MARGIN = 8;

const widthOf = (parent: Element | null | undefined): number =>
  [...(parent?.children ?? [])].reduce(
    (sum, each) => sum + (each as HTMLElement).offsetWidth,
    0,
  );

export function useOneLineFit(written: Written, opened: boolean) {
  const inner = useRef<HTMLDivElement>(null);
  const writing = useRef<HTMLDivElement>(null);
  const room = useRef<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [wrapped, setWrapped] = useState(false);
  const expanded = wrapped || opened;

  const measure = useEffectEvent(() => {
    const box = inner.current;
    const field = writing.current?.querySelector('[contenteditable]');
    if (!box || !field) {
      return;
    }

    setHeight(box.offsetHeight);

    if (!expanded) {
      room.current = field.clientWidth;
      if (field.scrollHeight > ONE_LINE) {
        setWrapped(true);
      }
      return;
    }

    if (field.scrollHeight > ONE_LINE) {
      return;
    }

    const line = widthOf(field.firstElementChild);

    if (room.current !== null && line + FIT_MARGIN <= room.current) {
      setWrapped(false);
    }
  });

  useLayoutEffect(() => {
    const box = inner.current;
    const area = writing.current;
    if (!box || !area) {
      return;
    }

    const measured = new ResizeObserver(() => measure());
    measured.observe(box);
    measured.observe(area);

    return () => measured.disconnect();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: measure again after the written text renders
  useLayoutEffect(() => measure(), [written]);

  return { inner, writing, height, expanded };
}
