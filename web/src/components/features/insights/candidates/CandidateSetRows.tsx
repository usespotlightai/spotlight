import { BaselineRow } from '@/components/features/insights/candidates/BaselineRow';
import { CandidateComparisonRow } from '@/components/features/insights/candidates/CandidateComparisonRow';
import { ReplayedSetChart } from '@/components/features/insights/candidates/ReplayedSetChart';
import { SetSummary } from '@/components/features/insights/candidates/SetSummary';
import { FoldingRows } from '@/components/shared/nested-table/FoldingRows';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import {
  INNER_DIVIDER,
  INNER_GUIDE,
  INNER_INDENT,
  OUTER_GUIDE,
} from '@/components/shared/nested-table/nested-rows';
import {
  type CandidatesSet,
  rankedCandidates,
} from '@/lib/insights-candidates';
import type { ReplayedStation } from '@/lib/replay';
import { cn } from '@/lib/utils';

type CandidateSetRowsProps = {
  at: ReplayedStation;
  set: CandidatesSet;
  heldOut: boolean;
  charted: boolean;
  open: boolean;
  onToggle: () => void;
};

export function CandidateSetRows({
  at,
  set,
  heldOut,
  charted,
  open,
  onToggle,
}: CandidateSetRowsProps) {
  const candidates = charted ? [] : rankedCandidates(set);

  return (
    <>
      <NestedGroupRow
        label={set.name}
        open={open}
        depth={1}
        onToggle={onToggle}
      >
        <SetSummary at={at} set={set} />
      </NestedGroupRow>

      <FoldingRows open={open}>
        {charted && (
          <li
            data-slot="candidate-chart"
            className={cn(
              'relative col-span-full py-3 pr-2',
              INNER_INDENT,
              OUTER_GUIDE,
              INNER_GUIDE,
              INNER_DIVIDER,
            )}
          >
            <ReplayedSetChart set={set} />
          </li>
        )}

        {candidates.map((candidate) => (
          <CandidateComparisonRow
            key={candidate.candidateId}
            at={at}
            candidate={candidate}
            heldOut={heldOut}
          />
        ))}

        {!charted && set.baseline && (
          <BaselineRow at={at} baseline={set.baseline} heldOut={heldOut} />
        )}
      </FoldingRows>
    </>
  );
}
