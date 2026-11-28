import type { ReactNode } from 'react';

import { ScrollArea, VERTICAL_EDGE_FADE } from '@/components/ui/scroll-area';
import { nonEmpty } from '@/lib/non-empty';
import { cn } from '@/lib/utils';

export function AuthoredText({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn('flex min-w-0 flex-col gap-2', nonEmpty(label) && 'pt-2')}
    >
      {nonEmpty(label) && (
        <p className="text-muted-foreground text-xs">{label}</p>
      )}
      <ScrollArea
        data-slot="authored-text"
        className="max-h-[min(60vh,36rem)] min-w-0 rounded-lg bg-background/60"
        viewportClassName={VERTICAL_EDGE_FADE}
        contentClassName="px-5 py-4"
      >
        {children}
      </ScrollArea>
    </div>
  );
}
