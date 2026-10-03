import { HOST_COLUMNS } from '@/components/features/runners/columns';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

export function HostRowSkeleton() {
  return (
    <li
      className={cn(
        'grid h-9 items-center gap-3 rounded-md px-3 text-sm',
        HOST_COLUMNS,
      )}
    >
      <SkeletonLine className="w-24" />
      <SkeletonLine className="w-20 text-xs" />
      <span className="flex items-center gap-1.5 text-xs">
        <Skeleton className="size-1.5 rounded-full" />
        <SkeletonLine className="w-10" />
      </span>
      <SkeletonLine className="w-40 text-xs" />
      <span className="flex items-center gap-1.5">
        <Skeleton className="size-3.5 rounded-sm" />
        <Skeleton className="size-3.5 rounded-sm" />
      </span>
      <SkeletonLine className="w-8 text-xs" />
      <SkeletonLine className="ml-auto w-16 text-xs" />
    </li>
  );
}
