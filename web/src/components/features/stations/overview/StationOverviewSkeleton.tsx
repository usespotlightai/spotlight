import { StationConfigSkeleton } from '@/components/features/stations/config/StationConfigSkeleton';
import { RecentRunsSkeleton } from '@/components/features/stations/overview/RecentRunsSkeleton';
import { StationAttentionSkeleton } from '@/components/features/stations/overview/StationAttentionSkeleton';
import { SummarySkeleton } from '@/components/features/stations/overview/SummarySkeleton';

export function StationOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <SummarySkeleton />
      <StationConfigSkeleton />
      <StationAttentionSkeleton />
      <section className="flex flex-col gap-1.5">
        <h2 className="font-medium text-foreground text-xs">Runs</h2>
        <RecentRunsSkeleton />
      </section>
    </div>
  );
}
