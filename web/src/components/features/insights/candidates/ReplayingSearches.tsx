import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { ReplayingSearchResponseDto } from '@/lib/api';
import { formatStation, type StationNames } from '@/lib/insights';
import { since } from '@/lib/since';
import { stationPath } from '@/lib/station';
import { formatSearchState } from '@/lib/station-improvement';

type ReplayingSearchesProps = {
  slug: string;
  teamId: string;
  searches: readonly ReplayingSearchResponseDto[];
  names: StationNames;
};

export function ReplayingSearches({
  slug,
  teamId,
  searches,
  names,
}: ReplayingSearchesProps) {
  return (
    <InsightsCard
      flat
      title="Replaying now"
      description="Searches of this period that have no candidate to show yet. A search first replays the live config, then tries its candidates."
    >
      <ul className="flex flex-col divide-y text-sm">
        {searches.map((search) => (
          <li
            key={search.searchId}
            data-slot="replaying-search"
            className="flex items-baseline justify-between gap-3 py-2"
          >
            <TrailLink
              to={stationPath(slug, teamId, search.lineId, search.stationId)}
              className="min-w-0 truncate font-medium text-foreground hover:underline"
            >
              {formatStation(names, search.stationId)}
            </TrailLink>
            <span className="shrink-0 text-muted-foreground">
              {formatSearchState(search.state)}, started{' '}
              {since(search.startedAt)}
            </span>
          </li>
        ))}
      </ul>
    </InsightsCard>
  );
}
