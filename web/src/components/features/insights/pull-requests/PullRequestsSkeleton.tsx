import {
  PENETRATION_SERIES,
  TYPE_SERIES,
} from '@/components/features/insights/chart-series';
import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTableSkeleton } from '@/components/features/insights/InsightsTableSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { PENETRATION_CHART_HEIGHT } from '@/components/features/insights/pull-requests/PenetrationChart';
import { PullRequestFilters } from '@/components/features/insights/pull-requests/PullRequestFilters';
import { PullRequestListSkeleton } from '@/components/features/insights/pull-requests/PullRequestListSkeleton';
import { TYPES_CHART_HEIGHT } from '@/components/features/insights/pull-requests/PullRequestTypesChart';
import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import { ChartSkeleton } from '@/components/shared/skeleton/ChartSkeleton';
import type { InsightsView } from '@/lib/insights';
import {
  AGAINST_PEOPLE_NOTE,
  BY_REPOSITORY_NOTE,
  PULL_REQUEST_LIST_NOTE,
  REVIEW_DEPTH_NOTE,
  TYPES_NOTE,
  WEEK_BY_WEEK_NOTE,
} from '@/lib/insights-pull-requests';
import type { TileBones } from '@/lib/insights-tiles';

const TILES: readonly TileBones[] = [
  { label: 'PRs merged', detail: 'In the team’s repositories' },
  { label: 'Made by Spotlight' },
  {
    label: 'Reviewed by Spotlight',
    detail: 'Others’ pull requests with a Spotlight review task',
  },
  {
    label: 'Spotlight’s share',
    detail:
      'Share of all merged pull requests that Spotlight made or reviewed. Bots’ pull requests count.',
  },
];

const PENETRATION_LEGEND = PENETRATION_SERIES.map(({ label, fill }) => ({
  label,
  color: fill,
}));

const AUTHORS = ['Spotlight’s', 'People’s alone'];

type PullRequestsSkeletonProps = {
  view: InsightsView;
  onView: (view: InsightsView) => void;
};

export function PullRequestsSkeleton({
  view,
  onView,
}: PullRequestsSkeletonProps) {
  return (
    <div className="flex flex-col gap-3">
      <div
        role="status"
        aria-label="Loading the pull requests"
        className="flex flex-col gap-3"
      >
        <InsightsTilesSkeleton label="Merged pull requests" tiles={TILES} />
        <InsightsCardSkeleton
          switchable
          title="Week by week"
          description={WEEK_BY_WEEK_NOTE}
        >
          <figure className="flex flex-col gap-1">
            <ChartLegend entries={PENETRATION_LEGEND} />
            <ChartSkeleton height={PENETRATION_CHART_HEIGHT} />
          </figure>
        </InsightsCardSkeleton>

        <InsightsCardSkeleton
          tableOnly
          title="By repository"
          description={BY_REPOSITORY_NOTE}
        >
          <InsightsTableSkeleton
            label="Loading the share by repository"
            headers={['Repository', null, null, null, null, 'Merged', 'Share']}
          />
        </InsightsCardSkeleton>

        <InsightsCardSkeleton
          tableOnly
          title="Spotlight against people"
          description={AGAINST_PEOPLE_NOTE}
        >
          <InsightsTableSkeleton
            label="Loading Spotlight against people"
            headers={['Merged pull requests', ...AUTHORS]}
            rows={6}
          />
        </InsightsCardSkeleton>

        <InsightsCardSkeleton
          switchable
          title="What Spotlight ships"
          description={TYPES_NOTE}
        >
          <figure className="flex flex-col gap-1">
            <ChartLegend entries={TYPE_SERIES} />
            <ChartSkeleton height={TYPES_CHART_HEIGHT} />
          </figure>
        </InsightsCardSkeleton>

        <InsightsCardSkeleton
          tableOnly
          title="Review depth"
          description={REVIEW_DEPTH_NOTE}
        >
          <InsightsTableSkeleton
            label="Loading the review depth"
            headers={['Review rounds', ...AUTHORS]}
            rows={4}
          />
        </InsightsCardSkeleton>
      </div>

      <InsightsCardSkeleton
        title="Pull requests"
        description={PULL_REQUEST_LIST_NOTE}
        actions={
          <PullRequestFilters
            filter={view.filter}
            repositories={[]}
            onChange={(filter) => onView({ ...view, filter, page: 1 })}
          />
        }
      >
        <PullRequestListSkeleton />
      </InsightsCardSkeleton>
    </div>
  );
}
