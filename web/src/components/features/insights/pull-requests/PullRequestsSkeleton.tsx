import {
  AUTHOR_SERIES,
  SPOTLIGHT_SHARE_SERIES,
} from '@/components/features/insights/chart-series';
import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTableSkeleton } from '@/components/features/insights/InsightsTableSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { PAIR_GRID } from '@/components/features/insights/overview-layout';
import { PullRequestFilters } from '@/components/features/insights/pull-requests/PullRequestFilters';
import { PullRequestListSkeleton } from '@/components/features/insights/pull-requests/PullRequestListSkeleton';
import { StackedRowsSkeleton } from '@/components/features/insights/StackedRowsSkeleton';
import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
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
  { label: 'All PRs merged', detail: 'In the team’s repositories' },
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

const SPOTLIGHT_SHARE_LEGEND = SPOTLIGHT_SHARE_SERIES.map(
  ({ label, fill }) => ({
    label,
    color: fill,
  }),
);

const AUTHORS = ['Spotlight', 'People'];

type PullRequestsSkeletonProps = {
  view: InsightsView;
  onView: (view: InsightsView) => void;
};

const TYPE_ROWS = ['w-full', 'w-3/5', 'w-2/5', 'w-1/3', 'w-1/4', 'w-1/5'];

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
          flat
          switchable
          title="Week by week"
          description={WEEK_BY_WEEK_NOTE}
        >
          <figure className="flex flex-col gap-2">
            <ChartLegend entries={SPOTLIGHT_SHARE_LEGEND} />
            <StackedRowsSkeleton rows={5} />
          </figure>
        </InsightsCardSkeleton>

        <InsightsCardSkeleton
          flat
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
          flat
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

        <div className={PAIR_GRID}>
          <InsightsCardSkeleton
            flat
            switchable
            title="What Spotlight ships"
            description={TYPES_NOTE}
          >
            <figure className="flex flex-col gap-3">
              <ul aria-hidden className="flex flex-col gap-2">
                {TYPE_ROWS.map((width) => (
                  <li key={width} className="flex flex-col gap-1">
                    <SkeletonLine className="w-20 text-sm" />
                    <Skeleton className={`h-1.5 rounded-full ${width}`} />
                  </li>
                ))}
              </ul>
              <ChartLegend entries={AUTHOR_SERIES} />
            </figure>
          </InsightsCardSkeleton>

          <InsightsCardSkeleton
            flat
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
      </div>

      <InsightsCardSkeleton
        flat
        title="All pull requests"
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
