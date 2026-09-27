import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function RunRememberedSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading what the run remembered"
      className="flex flex-col rounded-xl border border-border px-3 py-2.5 text-xs leading-5"
    >
      <SkeletonLine className="w-1/3" />
    </div>
  );
}
