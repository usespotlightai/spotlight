import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { SignalHeadings } from '@/components/features/insights/SignalHeadings';
import { SignalRow } from '@/components/features/insights/SignalRow';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  countShown,
  improvingOf,
  type StationNames,
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
      description="Stations doing worse than the period before, or trailing the rest of the team."
    >
      {stations.length === 0 ? (
        <p className="py-2 text-muted-foreground text-sm">
          No station stands out this period.
        </p>
      ) : (
        <div className="grid gap-x-6 md:grid-cols-[minmax(10rem,14rem)_max-content_minmax(8rem,1fr)_repeat(4,max-content)_max-content]">
          <SignalHeadings />

          <ul
            aria-label="Stations worth improving"
            className="col-span-full grid grid-cols-subgrid divide-y divide-border"
          >
            {stations.map((station) => {
              const named = names.get(station.stationId);

              return (
                <li
                  key={station.stationId}
                  data-slot="worth-improving"
                  className="col-span-full grid grid-cols-subgrid gap-y-3 py-3 last:pb-1 md:items-center"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <TrailLink
                      to={stationPath(
                        slug,
                        teamId,
                        station.lineId,
                        station.stationId,
                      )}
                      className="truncate font-medium text-foreground text-sm hover:underline"
                    >
                      {stationShown(names, station.stationId)}
                    </TrailLink>
                    <p className="flex flex-wrap items-baseline gap-x-1.5 text-muted-foreground text-xs">
                      {named && <span>{named.lineName}</span>}
                      {named && <span aria-hidden>·</span>}
                      <InsightsLink
                        tab="runs"
                        filter={{ stationId: station.stationId }}
                        className="hover:text-foreground"
                      >
                        {countShown(station.runs)}{' '}
                        {station.runs === 1 ? 'run' : 'runs'}
                      </InsightsLink>
                    </p>
                  </div>

                  <div className="grid min-w-0 grid-cols-subgrid gap-y-1.5 md:col-span-6">
                    <ul className="col-span-full grid grid-cols-subgrid gap-y-3">
                      {station.signals.map((reading) => (
                        <SignalRow key={reading.signal} reading={reading} />
                      ))}
                    </ul>
                    {station.mixedCurrencies && (
                      <p className="col-span-full text-muted-foreground text-xs">
                        Cost not compared: prices in more than one currency
                      </p>
                    )}
                  </div>

                  {named && (
                    <ImproveStationLink
                      slug={slug}
                      teamId={teamId}
                      improving={improvingOf(named)}
                      className="justify-self-start md:justify-self-end"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </InsightsCard>
  );
}
