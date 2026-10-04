import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitleSkeleton } from '@/components/shared/skeleton/DecisionTitleSkeleton';
import { PillSkeleton } from '@/components/shared/skeleton/PillSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function GradeRunSkeleton() {
  return (
    <DecisionCard role="status" aria-label="Loading the run to grade">
      <DecisionHeader title={<DecisionTitleSkeleton className="w-56" />} />
      <div className="flex flex-col">
        <SkeletonLine className="w-80 text-sm" />
        <SkeletonLine className="w-64 text-sm" />
      </div>
      <div className="flex gap-2">
        <PillSkeleton className="w-10" />
        <PillSkeleton className="w-10" />
      </div>
    </DecisionCard>
  );
}
