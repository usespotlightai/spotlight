import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { formatCount, formatShare } from '@/lib/insights';
import {
  mergedPullRequestsFilter,
  type RepositorySpotlightShare as Repository,
  type WeekShare,
  weekFilter,
} from '@/lib/insights-pull-requests';
import { formatDay } from '@/lib/judge';

type RepositorySpotlightShareProps = {
  weeks: readonly string[];
  repositories: readonly Repository[];
};

const weekCell = (repository: Repository, week: WeekShare | undefined) =>
  week && week.merged > 0 ? (
    <InsightsLink
      tab="productivity"
      filter={weekFilter(week.week, repository.repository)}
    >
      <span
        title={`${week.spotlight} of ${week.merged} made or reviewed by Spotlight`}
      >
        {formatShare(week.rate)}
      </span>
    </InsightsLink>
  ) : (
    '–'
  );

export function RepositorySpotlightShare({
  weeks,
  repositories,
}: RepositorySpotlightShareProps) {
  const columns: InsightsColumn<Repository>[] = [
    {
      id: 'repository',
      header: 'Repository',
      cell: (repository) => repository.repository,
    },
    ...weeks.map(
      (week): InsightsColumn<Repository> => ({
        id: week,
        header: formatDay(week),
        numeric: true,
        cell: (repository) =>
          weekCell(
            repository,
            repository.weeks.find((each) => each.week === week),
          ),
      }),
    ),
    {
      id: 'merged',
      header: 'Merged',
      numeric: true,
      cell: (repository) =>
        repository.merged > 0 ? (
          <InsightsLink
            tab="productivity"
            filter={mergedPullRequestsFilter({
              repository: repository.repository,
            })}
          >
            {formatCount(repository.merged)}
          </InsightsLink>
        ) : (
          formatCount(0)
        ),
    },
    {
      id: 'share',
      header: 'Share',
      numeric: true,
      cell: (repository) => formatShare(repository.rate),
    },
  ];

  return (
    <InsightsCard
      tableOnly
      title="By repository"
      description="Share of each repository’s weekly merges that Spotlight made or reviewed."
    >
      <InsightsTable
        label="Spotlight’s share by repository and week"
        columns={columns}
        rows={repositories}
        rowKey={(repository) => repository.repository}
      />
    </InsightsCard>
  );
}
