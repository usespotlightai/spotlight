import { type RefObject, useEffect, useState } from 'react';

export function useTraySpace(
  space: RefObject<HTMLDivElement | null>,
  cover: number,
): number {
  const [height, setHeight] = useState(cover);

  if (cover > height) {
    setHeight(cover);
  }

  useEffect(() => {
    const box = space.current?.closest('[data-slot=scroll-area-viewport]');

    if (!box || height <= cover) {
      return;
    }

    const release = () => {
      const below = box.scrollHeight - box.scrollTop - box.clientHeight;
      const kept = Math.max(cover, height - Math.floor(below));

      if (kept < height) {
        setHeight(kept);
      }
    };

    const frame = requestAnimationFrame(release);
    box.addEventListener('scroll', release, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      box.removeEventListener('scroll', release);
    };
  }, [space, cover, height]);

  return height;
}
