import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function RunMemoriesDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the run’s memories"
      className="flex flex-col gap-2 text-xs leading-5"
    >
      <SkeletonLine className="w-1/4" />
      <SkeletonLine className="w-3/4" />
      <SkeletonLine className="w-2/3" />
    </div>
  );
}
