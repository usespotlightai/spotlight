import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { countShown, shareShown } from '@/lib/insights';
import {
  mergedPullRequestsFilter,
  type RepositoryPenetration as Repository,
  type WeekShare,
  weekFilter,
} from '@/lib/insights-pull-requests';
import { dayShown } from '@/lib/judge';

type RepositoryPenetrationProps = {
  weeks: readonly string[];
  repositories: readonly Repository[];
};

const weekCell = (repository: Repository, week: WeekShare | undefined) =>
  week && week.merged > 0 ? (
    <InsightsLink
      tab="pull-requests"
      filter={weekFilter(week.week, repository.repository)}
    >
      <span
        title={`${week.made + week.touched} of ${week.merged} made by Spotlight or with a Spotlight review task opened`}
      >
        {shareShown(week.share)}
      </span>
    </InsightsLink>
  ) : (
    '–'
  );

export function RepositoryPenetration({
  weeks,
  repositories,
}: RepositoryPenetrationProps) {
  const columns: InsightsColumn<Repository>[] = [
    {
      id: 'repository',
      header: 'Repository',
      cell: (repository) => repository.repository,
    },
    ...weeks.map(
      (week): InsightsColumn<Repository> => ({
        id: week,
        header: dayShown(week),
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
            tab="pull-requests"
            filter={mergedPullRequestsFilter({
              repository: repository.repository,
            })}
          >
            {countShown(repository.merged)}
          </InsightsLink>
        ) : (
          countShown(0)
        ),
    },
    {
      id: 'share',
      header: 'Share',
      numeric: true,
      cell: (repository) => shareShown(repository.share),
    },
  ];

  return (
    <InsightsCard
      title="By repository"
      description="Of what merged in each repository each week, the share Spotlight made or reviewed."
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
