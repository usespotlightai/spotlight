import type { ReactElement } from 'react';

import { Skeleton } from '@/components/shared/skeleton/Skeleton';

export function ChartSkeleton({ height }: { height: number }): ReactElement {
  return <Skeleton className="w-full rounded-md" style={{ height }} />;
}
