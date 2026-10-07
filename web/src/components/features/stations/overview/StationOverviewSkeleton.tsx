import { StationConfigSkeleton } from '@/components/features/stations/config/StationConfigSkeleton';
import { GlanceSkeleton } from '@/components/features/stations/overview/GlanceSkeleton';
import { RecentRunsSkeleton } from '@/components/features/stations/overview/RecentRunsSkeleton';

export function StationOverviewSkeleton() {
  return (
    <>
      <GlanceSkeleton />
      <StationConfigSkeleton />
      <section className="flex flex-col gap-1.5">
        <h2 className="font-medium text-foreground text-xs">Runs</h2>
        <RecentRunsSkeleton />
      </section>
    </>
  );
}
