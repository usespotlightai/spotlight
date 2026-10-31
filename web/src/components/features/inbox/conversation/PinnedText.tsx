import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function PinnedText({ children }: { children: ReactNode }) {
  return <ScrollArea className="max-h-[40vh]">{children}</ScrollArea>;
}
