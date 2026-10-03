import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function RememberedDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading what the run remembered"
      className="flex flex-col gap-2 text-xs leading-5"
    >
      <SkeletonLine className="w-1/4" />
      <SkeletonLine className="w-3/4" />
      <SkeletonLine className="w-2/3" />
    </div>
  );
}
