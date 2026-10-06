import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { SpreadShown } from '@/components/features/insights/SpreadShown';
import { countShown, medianShown, shareShown, tailShown } from '@/lib/insights';
import {
  type GroupMeasures,
  groupFilter,
  type InsightsPullRequests,
  meanShown,
  type PullRequestFilter,
} from '@/lib/insights-pull-requests';

type Measure = {
  readonly id: string;
  readonly label: string;
  readonly shown: (measures: GroupMeasures) => string;
  readonly tail?: (measures: GroupMeasures) => string | null;
  readonly narrowed?: PullRequestFilter;
};

const MEASURES: readonly Measure[] = [
  {
    id: 'merged',
    label: 'Merged',
    shown: (measures) => countShown(measures.merged),
  },
  {
    id: 'to-merge',
    label: 'Time to merge',
    shown: (measures) => medianShown(measures.toMerge),
    tail: (measures) => tailShown(measures.toMerge),
  },
  {
    id: 'in-review',
    label: 'Time in review',
    shown: (measures) => medianShown(measures.inReview),
    tail: (measures) => tailShown(measures.inReview),
  },
  {
    id: 'rounds',
    label: 'Review rounds',
    shown: (measures) => meanShown(measures.meanRounds),
  },
  {
    id: 'comments',
    label: 'Review comments',
    shown: (measures) => meanShown(measures.meanComments),
  },
  {
    id: 'reverted',
    label: 'Revert rate',
    shown: (measures) =>
      `${shareShown(measures.revertRate)} · ${countShown(measures.reverted)}`,
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
            {measure.shown(measures)}
          </InsightsLink>
        ) : (
          measure.shown(measures)
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
      title="Spotlight against people"
      description={
        comparison.repositories.length > 0
          ? `People’s exclude bots’ and any with a Spotlight review task. Times are medians, with the p90 under the info icon; rounds and comments per pull request. Repositories Spotlight merged into: ${comparison.repositories.join(', ')}`
          : 'Spotlight merged nothing in this period. Nothing to compare people’s pull requests with.'
      }
    >
      <InsightsTable
        label="Spotlight’s pull requests against people’s"
        columns={columns}
        rows={MEASURES}
        rowKey={(measure) => measure.id}
      />
    </InsightsCard>
  );
}
