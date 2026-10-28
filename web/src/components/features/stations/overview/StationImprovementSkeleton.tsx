import { Info } from 'lucide-react';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function StationImprovementSkeleton() {
  return (
    <span
      aria-hidden
      className="flex min-w-0 items-center gap-1.5 py-0.5 text-xs"
    >
      <Skeleton className="size-3.5 shrink-0 rounded-full" />
      <SkeletonLine className="w-20" />
      <Info aria-hidden className="size-3.5 text-muted-foreground" />
    </span>
  );
}
