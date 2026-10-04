import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

export function DecisionTitleSkeleton({ className }: { className?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Skeleton className="size-4 rounded-full" />
      <SkeletonLine className={cn('text-sm', className)} />
    </span>
  );
}
