import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function CandidatesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the candidates"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <SkeletonLine className="w-32 text-sm" />
        <SkeletonLine className="w-3/4 text-xs" />
        <div className="flex gap-2">
          <SkeletonLine className="w-24 text-xs" />
          <SkeletonLine className="w-20 text-xs" />
        </div>
        <SkeletonLine className="w-1/2 text-xs" />
        <SkeletonLine className="h-40 w-full" />
      </div>
    </div>
  );
}
