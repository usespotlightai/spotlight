import { StationIcon } from '@/components/features/board/column/StationIcon';
import { TraceErrorCount } from '@/components/features/trace/list/TraceErrorCount';
import type { InsightsTrace } from '@/lib/insights';
import { stationShare } from '@/lib/station';
import { cn } from '@/lib/utils';

type TraceStationsProps = Pick<InsightsTrace, 'stations' | 'errors'>;

export function TraceStations({ stations, errors }: TraceStationsProps) {
  const slots = errors > 0 ? 2 : 3;
  const folded = stations.length > slots ? stations.length - slots + 1 : 0;
  const shown = stations.length - folded;

  return (
    <>
      {stations.map((station, index) => (
        <StationIcon
          key={station.stationId}
          share={stationShare(station.position, station.count)}
          color={station.color}
          className={cn(index >= shown && '@max-md/pane:hidden')}
        />
      ))}

      {folded > 0 && (
        <span
          aria-hidden
          className="text-muted-foreground text-xs tabular-nums @md/pane:hidden"
        >
          +{folded}
        </span>
      )}

      <TraceErrorCount errors={errors} className="ml-1 @2xl/pane:hidden" />
    </>
  );
}
