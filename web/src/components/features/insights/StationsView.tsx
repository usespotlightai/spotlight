import { EveryStationView } from '@/components/features/insights/EveryStationView';
import { StationInsightsView } from '@/components/features/insights/station/StationInsightsView';
import type { InsightsPeriod, StationNames } from '@/lib/insights';

type StationsViewProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
  stationId: string | undefined;
};

export function StationsView({ stationId, ...shared }: StationsViewProps) {
  if (stationId) {
    return <StationInsightsView {...shared} stationId={stationId} />;
  }

  return <EveryStationView {...shared} />;
}
