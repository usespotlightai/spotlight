import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function JudgeAgreementSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading how the judge agrees with people"
      className="flex flex-col gap-3"
    >
      <SkeletonLine className="w-72 text-sm" />
      <SkeletonLine className="w-56 text-xs" />

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
        <SkeletonLine className="w-32 text-xs" />
        <SkeletonLine className="w-48 text-xs" />
        <SkeletonLine className="w-24 text-xs" />
      </div>
    </div>
  );
}
