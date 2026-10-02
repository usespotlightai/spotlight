import { ReplayedCandidateRow } from '@/components/features/insights/candidates/ReplayedCandidateRow';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { spentIn } from '@/lib/inbox';
import {
  type CandidatesSet,
  LIVE_OVER_SET,
  replaySuccessShown,
} from '@/lib/insights-candidates';
import { type ReplayedStation, replayPath } from '@/lib/replay';

type ReplayedTableProps = {
  at: ReplayedStation;
  set: CandidatesSet;
};

export function ReplayedTable({ at, set }: ReplayedTableProps) {
  const baseline = set.baseline;

  return (
    <ul
      aria-label={`Candidates replayed over ${set.name}`}
      className="flex flex-col divide-y divide-border"
    >
      {baseline && (
        <li
          data-slot="replayed-baseline"
          className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 py-2 text-xs"
        >
          <TrailLink
            to={replayPath(at, baseline.replayId)}
            className="font-medium text-foreground text-sm underline-offset-2 hover:underline"
          >
            {LIVE_OVER_SET}
          </TrailLink>
          <span className="text-foreground tabular-nums">
            {replaySuccessShown(baseline.successRate, baseline.scored)}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {baseline.costPerRun === null
              ? 'Unpriced'
              : `${spentIn(baseline.costPerRun, baseline.currency)} a run`}
          </span>
        </li>
      )}
      {set.candidates.map((candidate) => (
        <ReplayedCandidateRow
          key={candidate.candidateId}
          at={at}
          candidate={candidate}
        />
      ))}
    </ul>
  );
}
