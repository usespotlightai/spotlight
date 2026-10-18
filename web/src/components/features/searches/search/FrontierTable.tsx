import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { GainWithPairs } from '@/components/features/replays/GainWithPairs';
import { HeldOutScore } from '@/components/features/replays/HeldOutScore';
import { ScoredRate } from '@/components/features/replays/ScoredRate';
import { OverfitBadge } from '@/components/features/searches/OverfitBadge';
import { THE_SEARCH_START } from '@/lib/replay-words';
import {
  candidateName,
  formatCostPerRun,
  formatHeldOut,
  type SearchCandidate,
} from '@/lib/search';

type FrontierTableProps = {
  candidates: readonly SearchCandidate[];
  currency: string;
};

export function FrontierTable({ candidates, currency }: FrontierTableProps) {
  const columns: InsightsColumn<SearchCandidate>[] = [
    {
      id: 'candidate',
      header: 'Candidate',
      cell: (candidate) => (
        <>
          {candidateName(candidate)}
          {candidate.onFrontier && (
            <span className="ml-1.5 text-primary">frontier</span>
          )}
          {candidate.overfit && (
            <OverfitBadge
              mark={candidate.overfit}
              className="ml-1.5 align-middle"
            />
          )}
        </>
      ),
    },
    {
      id: 'iteration',
      header: 'Iteration',
      numeric: true,
      cell: (candidate) => candidate.iteration ?? '–',
    },
    {
      id: 'searched',
      header: 'Searched',
      numeric: true,
      cell: (candidate) => (
        <ScoredRate
          rate={candidate.searchScore}
          interval={candidate.searchInterval}
          scored={candidate.searchScored}
        />
      ),
    },
    {
      id: 'searched-gain',
      header: 'Gain on searched',
      cell: (candidate) => (
        <GainWithPairs
          gain={candidate.searchedGain}
          pairs={candidate.searchedPairs}
          against={THE_SEARCH_START}
        />
      ),
    },
    {
      id: 'held-out',
      header: 'Held out',
      numeric: true,
      cell: (candidate) => (
        <HeldOutScore
          rate={candidate.heldOutScore}
          interval={candidate.heldOutInterval}
          unscored={formatHeldOut(candidate)}
        />
      ),
    },
    {
      id: 'held-out-gain',
      header: 'Gain on held out',
      cell: (candidate) => (
        <GainWithPairs
          gain={candidate.heldOutGain}
          pairs={candidate.heldOutPairs}
          against={THE_SEARCH_START}
        />
      ),
    },
    {
      id: 'cost',
      header: 'Cost per run',
      numeric: true,
      cell: (candidate) => formatCostPerRun(candidate.costPerRun, currency),
    },
  ];

  return (
    <InsightsTable
      label="Candidates by success and cost"
      columns={columns}
      rows={candidates}
      rowKey={(candidate) => candidate.candidateId}
    />
  );
}
