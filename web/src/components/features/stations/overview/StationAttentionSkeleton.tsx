import { ATTENTION_TITLE } from '@/components/features/stations/overview/attention';
import { WorthImprovingSkeleton } from '@/components/features/stations/overview/WorthImprovingSkeleton';

export function StationAttentionSkeleton() {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="flex min-h-6 items-center font-medium text-foreground text-xs">
        {ATTENTION_TITLE}
      </h2>

      <WorthImprovingSkeleton />
    </section>
  );
}
