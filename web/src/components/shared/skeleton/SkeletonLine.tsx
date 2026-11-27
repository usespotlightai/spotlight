import type { ReactElement } from 'react';

import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { cn } from '@/lib/utils';

export function SkeletonLine({
  className,
}: {
  className?: string;
}): ReactElement {
  return (
    <span
      aria-hidden
      className={cn('flex h-lh min-w-0 items-center', className)}
    >
      <Skeleton className="h-[0.7em] w-full shrink" />
    </span>
  );
}
