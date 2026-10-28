import { ATTENTION_TITLE } from '@/components/features/stations/overview/attention';
import { StationImprovementSkeleton } from '@/components/features/stations/overview/StationImprovementSkeleton';
import { WorthImprovingSkeleton } from '@/components/features/stations/overview/WorthImprovingSkeleton';

export function StationAttentionSkeleton() {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 className="font-medium text-foreground text-xs">
          {ATTENTION_TITLE}
        </h2>
        <StationImprovementSkeleton />
      </div>

      <WorthImprovingSkeleton />
    </section>
  );
}
