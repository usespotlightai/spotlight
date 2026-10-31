import type { ReactNode } from 'react';
import { FadingScroll } from '@/components/shared/FadingScroll';

export function PinnedText({ children }: { children: ReactNode }) {
  return <FadingScroll className="max-h-[40vh]">{children}</FadingScroll>;
}
