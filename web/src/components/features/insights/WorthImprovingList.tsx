import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  countShown,
  improvingOf,
  type StationNames,
  signalShown,
  stationShown,
  type WorthImproving,
} from '@/lib/insights';
import { stationPath } from '@/lib/station';

type WorthImprovingListProps = {
  slug: string;
  teamId: string;
  stations: readonly WorthImproving[];
  names: StationNames;
};

export function WorthImprovingList({
  slug,
  teamId,
  stations,
  names,
}: WorthImprovingListProps) {
  return (
    <InsightsCard
      title="Stations worth improving"
      description="Stations whose runs got worse than the period before, or trail the rest of the team."
    >
      {stations.length === 0 ? (
        <p className="py-2 text-muted-foreground text-sm">
          Nothing stands out this period.
        </p>
      ) : (
        <ul
          aria-label="Stations worth improving"
          className="flex flex-col divide-y divide-border"
        >
          {stations.map((station) => {
            const named = names.get(station.stationId);

            return (
              <li
                key={station.stationId}
                data-slot="worth-improving"
                className="flex flex-wrap items-start gap-2 py-2"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <TrailLink
                      to={stationPath(
                        slug,
                        teamId,
                        station.lineId,
                        station.stationId,
                      )}
                      className="font-medium text-foreground hover:underline"
                    >
                      {stationShown(names, station.stationId)}
                    </TrailLink>
                    {named && (
                      <span className="text-muted-foreground text-xs">
                        {named.lineName}
                      </span>
                    )}
                    <InsightsLink
                      tab="runs"
                      filter={{ stationId: station.stationId }}
                      className="text-muted-foreground text-xs"
                    >
                      {countShown(station.runs)}{' '}
                      {station.runs === 1 ? 'run' : 'runs'}
                    </InsightsLink>
                  </p>
                  <ul className="flex flex-col text-muted-foreground text-xs">
                    {station.signals.map((reading) => (
                      <li key={reading.signal}>{signalShown(reading)}</li>
                    ))}
                    {station.mixedCurrencies && (
                      <li>
                        Its cost was not compared: prices came in more than one
                        currency
                      </li>
                    )}
                  </ul>
                </div>

                {named && (
                  <ImproveStationLink
                    slug={slug}
                    teamId={teamId}
                    improving={improvingOf(named)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </InsightsCard>
  );
}
