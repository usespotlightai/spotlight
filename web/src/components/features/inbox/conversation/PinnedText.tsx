import type { ReactNode } from 'react';

import { FadingScroll } from '@/components/shared/FadingScroll';

export function PinnedText({ children }: { children: ReactNode }) {
  return (
    <FadingScroll className="max-h-[min(27vh,9rem)] @max-xl/pane:max-h-none [@media(max-height:520px)]:max-h-none">
      {children}
    </FadingScroll>
  );
}
