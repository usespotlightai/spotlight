import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { SpreadShown } from '@/components/features/insights/SpreadShown';
import {
  formatCount,
  formatMedian,
  formatShare,
  formatTail,
} from '@/lib/insights';
import {
  AGAINST_PEOPLE_NOTE,
  formatMean,
  type GroupMeasures,
  groupFilter,
  type InsightsPullRequests,
  type PullRequestFilter,
} from '@/lib/insights-pull-requests';

type Measure = {
  readonly id: string;
  readonly label: string;
  readonly render: (measures: GroupMeasures) => string;
  readonly tail?: (measures: GroupMeasures) => string | null;
  readonly narrowed?: PullRequestFilter;
};

const MEASURES: readonly Measure[] = [
  {
    id: 'merged',
    label: 'Merged',
    render: (measures) => formatCount(measures.merged),
  },
  {
    id: 'to-merge',
    label: 'Time to merge',
    render: (measures) => formatMedian(measures.toMerge),
    tail: (measures) => formatTail(measures.toMerge),
  },
  {
    id: 'in-review',
    label: 'Time in review',
    render: (measures) => formatMedian(measures.inReview),
    tail: (measures) => formatTail(measures.inReview),
  },
  {
    id: 'rounds',
    label: 'Review rounds',
    render: (measures) => formatMean(measures.meanRounds),
  },
  {
    id: 'comments',
    label: 'Review comments',
    render: (measures) => formatMean(measures.meanComments),
  },
  {
    id: 'reverted',
    label: 'Revert rate',
    render: (measures) =>
      `${formatShare(measures.revertRate)} · ${formatCount(measures.reverted)}`,
    narrowed: { reverted: 'true' },
  },
];

type SpotlightAgainstPeopleProps = {
  comparison: InsightsPullRequests['comparison'];
};

export function SpotlightAgainstPeople({
  comparison,
}: SpotlightAgainstPeopleProps) {
  const cell =
    (author: 'spotlight' | 'people') =>
    (measure: Measure): ReactNode => {
      const measures = comparison[author];
      const shown =
        measures.merged > 0 ? (
          <InsightsLink
            tab="productivity"
            filter={groupFilter(
              author,
              comparison.repositories,
              measure.narrowed,
            )}
          >
            {measure.render(measures)}
          </InsightsLink>
        ) : (
          measure.render(measures)
        );

      return (
        <SpreadShown tail={measure.tail?.(measures) ?? null}>
          {shown}
        </SpreadShown>
      );
    };

  const columns: InsightsColumn<Measure>[] = [
    { id: 'measure', header: 'Merged pull requests', cell: (m) => m.label },
    {
      id: 'spotlight',
      header: 'Spotlight’s',
      numeric: true,
      cell: cell('spotlight'),
    },
    {
      id: 'people',
      header: 'People’s alone',
      numeric: true,
      cell: cell('people'),
    },
  ];

  return (
    <InsightsCard
      tableOnly
      scrolls
      title="Spotlight against people"
      description={
        comparison.repositories.length > 0
          ? `${AGAINST_PEOPLE_NOTE} Repositories Spotlight merged into: ${comparison.repositories.join(', ')}`
          : 'Spotlight merged no pull requests in this period. There is nothing to compare people’s pull requests with.'
      }
    >
      <InsightsTable
        label="Spotlight’s pull requests compared with people’s"
        columns={columns}
        rows={MEASURES}
        rowKey={(measure) => measure.id}
      />
    </InsightsCard>
  );
}
