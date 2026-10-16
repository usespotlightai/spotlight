import { useState } from 'react';

export type SlideFrom = 'left' | 'right';

export function useSlideFrom(deeper: boolean): SlideFrom | null {
  const [was, setWas] = useState(deeper);
  const [from, setFrom] = useState<SlideFrom | null>(null);

  if (was !== deeper) {
    setWas(deeper);
    setFrom(deeper ? 'right' : 'left');
  }

  return from;
}
