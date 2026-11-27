import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { FactRow } from '@/components/shared/FactRow';
import { DecisionTitleSkeleton } from '@/components/shared/skeleton/DecisionTitleSkeleton';
import { PillSkeleton } from '@/components/shared/skeleton/PillSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function ProposedMemoriesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the memories this run proposed"
      className="flex flex-col gap-3"
    >
      <SkeletonLine className="w-64 py-0.5 text-xs" />

      <DecisionCard>
        <DecisionHeader title={<DecisionTitleSkeleton className="w-44" />} />
        <div>
          {['w-full', 'w-24', 'w-32'].map((width) => (
            <FactRow key={width}>
              <SkeletonLine className="w-16 text-sm leading-6" />
              <SkeletonLine className={`${width} text-sm leading-6`} />
            </FactRow>
          ))}
        </div>
        <div className="flex justify-end gap-1">
          <PillSkeleton className="w-18" />
          <PillSkeleton className="w-18" />
        </div>
      </DecisionCard>
    </div>
  );
}
