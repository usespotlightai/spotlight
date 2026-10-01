import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { countShown, shareShown, spreadShown } from '@/lib/insights';
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
    shown: (measures) => spreadShown(measures.toMerge),
  },
  {
    id: 'in-review',
    label: 'Time in review',
    shown: (measures) => spreadShown(measures.inReview),
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

      return measures.merged > 0 ? (
        <InsightsLink
          tab="pull-requests"
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
      title="Spotlight against people"
      description={
        comparison.repositories.length > 0
          ? `Pull requests merged in the repositories Spotlight merged into: ${comparison.repositories.join(', ')}. People’s leave out bots’ and any with a Spotlight review task opened. Times are the median and the p90; rounds and comments are per pull request.`
          : 'Spotlight merged nothing in this period, so there is nothing to set people’s pull requests against.'
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
