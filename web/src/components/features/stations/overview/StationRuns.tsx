import { useId } from 'react';
import { StationRecentRuns } from '@/components/features/stations/overview/StationRecentRuns';

type StationRunsProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

export function StationRuns(props: StationRunsProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1.5">
      <h2 id={titleId} className="font-medium text-foreground text-xs">
        Runs
      </h2>

      <StationRecentRuns {...props} />
    </section>
  );
}
