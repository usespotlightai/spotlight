import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function GradeRunSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the run to grade"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <SkeletonLine className="w-28 text-sm" />
        <SkeletonLine className="w-80 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <SkeletonLine className="w-48 text-sm" />
        <SkeletonLine className="w-64 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <SkeletonLine className="w-24 text-sm" />
        <SkeletonLine className="w-56 text-sm" />
      </div>
      <div className="flex gap-2">
        <SkeletonLine className="w-14 text-sm" />
        <SkeletonLine className="w-14 text-sm" />
      </div>
    </div>
  );
}
