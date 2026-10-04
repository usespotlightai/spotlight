import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitleSkeleton } from '@/components/shared/skeleton/DecisionTitleSkeleton';
import { PillSkeleton } from '@/components/shared/skeleton/PillSkeleton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function StationAlertSkeleton() {
  return (
    <DecisionCard role="status" aria-label="Loading the alert">
      <DecisionHeader
        title={<DecisionTitleSkeleton className="w-56" />}
        trailing={<SkeletonLine className="w-12 text-xs" />}
      />
      <div className="mb-2 flex flex-col">
        <SkeletonLine className="w-full text-sm" />
        <SkeletonLine className="w-2/3 text-sm" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-40 w-full" />
        <SkeletonLine className="w-48 text-xs" />
      </div>
      <div className="flex gap-2">
        <PillSkeleton className="w-28" />
        <PillSkeleton className="w-32" />
        <PillSkeleton className="w-36" />
      </div>
    </DecisionCard>
  );
}
