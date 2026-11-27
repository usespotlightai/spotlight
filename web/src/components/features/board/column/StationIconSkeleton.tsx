import type { ReactElement } from 'react';

import { Skeleton } from '@/components/shared/skeleton/Skeleton';

export function StationIconSkeleton(): ReactElement {
  return (
    <span
      aria-hidden
      className="flex size-4 shrink-0 items-center justify-center"
    >
      <Skeleton className="size-3.5 rounded-full" />
    </span>
  );
}
