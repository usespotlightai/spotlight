import { BaselineRow } from '@/components/features/insights/candidates/BaselineRow';
import { CandidateComparisonRow } from '@/components/features/insights/candidates/CandidateComparisonRow';
import { ReplayedSetChart } from '@/components/features/insights/candidates/ReplayedSetChart';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import type { CandidatesSet } from '@/lib/insights-candidates';
import { cn } from '@/lib/utils';

type CandidateSetRowsProps = {
  set: CandidatesSet;
  heldOut: boolean;
  chartStatus: boolean;
};

export function CandidateSetRows({
  set,
  heldOut,
  chartStatus,
}: CandidateSetRowsProps) {
  const candidates = chartStatus ? [] : set.candidates;

  return (
    <>
      {chartStatus && (
        <li
          data-slot="candidate-chart"
          className={cn(
            'relative col-span-full py-3 pr-2',
            OUTER_INDENT,
            OUTER_GUIDE,
            OUTER_DIVIDER,
          )}
        >
          <ReplayedSetChart set={set} />
        </li>
      )}

      {candidates.map((candidate) => (
        <CandidateComparisonRow
          key={candidate.candidateId}
          candidate={candidate}
          heldOut={heldOut}
        />
      ))}

      {!chartStatus && set.baseline && (
        <BaselineRow baseline={set.baseline} heldOut={heldOut} />
      )}
    </>
  );
}
