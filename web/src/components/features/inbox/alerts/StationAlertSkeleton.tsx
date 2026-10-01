import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function StationAlertSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the alert"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <SkeletonLine className="w-48 text-sm" />
        <SkeletonLine className="w-72 text-sm" />
      </div>
      <SkeletonLine className="h-32 w-full" />
      <div className="flex gap-2">
        <SkeletonLine className="w-28 text-sm" />
        <SkeletonLine className="w-36 text-sm" />
      </div>
    </div>
  );
}
