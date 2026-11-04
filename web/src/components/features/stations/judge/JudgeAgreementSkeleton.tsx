import { TabSection } from '@/components/features/stations/TabSection';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { COVERAGE_PARTS } from '@/lib/judge';

export function JudgeAgreementSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading how the judge agrees with people"
      className="@container flex flex-col gap-10"
    >
      <TabSection title="Who scored the last runs">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {COVERAGE_PARTS.map((part) => (
              <div key={part.key} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-xs">
                  {part.label}
                </span>
                <SkeletonLine className="w-12 text-sm" />
              </div>
            ))}
          </div>
        </div>
      </TabSection>

      <TabSection title="Agreement">
        <div className="flex flex-wrap gap-x-12 gap-y-4">
          {[0, 1, 2].map((at) => (
            <div key={at} className="flex flex-col gap-1">
              <SkeletonLine className="w-20 text-xs" />
              <SkeletonLine className="w-12 text-xl leading-7" />
            </div>
          ))}
        </div>
      </TabSection>

      <div className="grid gap-x-12 gap-y-10 @2xl:grid-cols-[auto_minmax(0,1fr)]">
        <TabSection title="Where they disagree">
          <Skeleton className="size-40 rounded-md" />
        </TabSection>
        <TabSection title="Over time">
          <Skeleton className="h-44 w-full rounded-md" />
        </TabSection>
      </div>
    </div>
  );
}
