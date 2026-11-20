import { use, useEffect, useRef, useState } from 'react';

import { DecisionTrayContext } from '@/lib/decision-tray';

export function DecisionTraySpace() {
  const cover = use(DecisionTrayContext)?.cover ?? 0;
  const space = useRef<HTMLDivElement>(null);
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
  }, [cover, height]);

  return (
    <div
      ref={space}
      aria-hidden
      data-slot="decision-tray-space"
      className="shrink-0"
      style={{ height }}
    />
  );
}
