import { Fragment } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { SignalRow } from '@/components/features/insights/SignalRow';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { CollapsibleRows } from '@/components/shared/nested-table/CollapsibleRows';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useCollapsibles } from '@/hooks/useCollapsibles';
import {
  formatCount,
  formatStation,
  STATIONS_WORTH_IMPROVING_HEADINGS,
  STATIONS_WORTH_IMPROVING_NOTE,
  type StationNames,
  targetStationOf,
  type WorthImproving,
} from '@/lib/insights';
import { stationPath } from '@/lib/station';
import { cn } from '@/lib/utils';

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
  const collapsibles = useCollapsibles();

  return (
    <InsightsCard
      scrolls
      title="Stations worth improving"
      description={STATIONS_WORTH_IMPROVING_NOTE}
    >
      {stations.length === 0 ? (
        <p className="py-2 text-muted-foreground text-sm">
          No station needs attention this period.
        </p>
      ) : (
        <NestedTable
          label="Stations worth improving"
          headings={STATIONS_WORTH_IMPROVING_HEADINGS}
          trailing
        >
          {stations.map((station) => {
            const named = names.get(station.stationId);
            const name = formatStation(names, station.stationId);
            const open = collapsibles.isOpen(station.stationId);

            return (
              <Fragment key={station.stationId}>
                <NestedGroupRow
                  label={name}
                  open={open}
                  depth={0}
                  onToggle={() => collapsibles.toggle(station.stationId)}
                  spans="@4xl:col-span-6"
                  cells={
                    named ? (
                      <ImproveStationLink
                        slug={slug}
                        teamId={teamId}
                        targetStation={targetStationOf(named)}
                        className="h-5 justify-self-start px-2 text-[0.7rem] @4xl:justify-self-end"
                      />
                    ) : (
                      <span aria-hidden />
                    )
                  }
                >
                  <span
                    data-slot="worth-improving"
                    className="flex min-w-0 items-baseline gap-2"
                  >
                    <TrailLink
                      to={stationPath(
                        slug,
                        teamId,
                        station.lineId,
                        station.stationId,
                      )}
                      className="truncate font-medium text-foreground hover:underline"
                    >
                      {name}
                    </TrailLink>
                    {named && (
                      <span className="text-muted-foreground">
                        {named.lineName}
                      </span>
                    )}
                    <InsightsLink
                      tab="runs"
                      filter={{ stationId: station.stationId }}
                      className="whitespace-nowrap text-muted-foreground hover:text-foreground"
                    >
                      {formatCount(station.runs)}{' '}
                      {station.runs === 1 ? 'run' : 'runs'}
                    </InsightsLink>
                  </span>
                </NestedGroupRow>
                <CollapsibleRows open={open} label={`Signals for ${name}`}>
                  {station.signals.map((reading) => (
                    <SignalRow key={reading.signal} reading={reading} />
                  ))}
                  {station.mixedCurrencies && (
                    <li
                      className={cn(
                        'relative col-span-full py-2 pr-2 text-muted-foreground text-xs',
                        OUTER_GUIDE,
                        OUTER_INDENT,
                      )}
                    >
                      Cost isn’t compared. Prices are in more than one currency.
                    </li>
                  )}
                </CollapsibleRows>
              </Fragment>
            );
          })}
        </NestedTable>
      )}
    </InsightsCard>
  );
}
