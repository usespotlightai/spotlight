import { GlanceSkeleton } from '@/components/features/stations/overview/GlanceSkeleton';
import { StationSection } from '@/components/features/stations/StationSection';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function StationOverviewSkeleton() {
  return (
    <>
      <StationSection title="Latest runs on this config">
        <GlanceSkeleton />
      </StationSection>

      <StationSection title="Recent runs">
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {['w-40', 'w-32', 'w-36'].map((width) => (
            <div
              key={width}
              className="flex items-center gap-3 px-2 py-2 text-sm"
            >
              <SkeletonLine className={width} />
              <SkeletonLine className="w-16 text-xs" />
            </div>
          ))}
        </div>
      </StationSection>
    </>
  );
}
