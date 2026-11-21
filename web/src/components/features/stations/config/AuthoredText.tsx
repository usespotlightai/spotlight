import type { ReactNode } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const EDGE_FADE =
  '[mask-image:linear-gradient(to_bottom,transparent,black_min(48px,var(--scroll-area-overflow-y-start,0px)),black_calc(100%-min(48px,var(--scroll-area-overflow-y-end,0px))),transparent)]';

export function AuthoredText({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', label && 'pt-2')}>
      {label && <p className="text-muted-foreground text-xs">{label}</p>}
      <ScrollArea
        data-slot="authored-text"
        className="max-h-[min(60vh,36rem)] min-w-0 rounded-lg bg-background/60"
        viewportClassName={EDGE_FADE}
        contentClassName="px-5 py-4"
      >
        {children}
      </ScrollArea>
    </div>
  );
}
