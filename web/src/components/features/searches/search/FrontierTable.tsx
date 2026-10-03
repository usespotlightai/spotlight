import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { GainVerdict } from '@/components/features/replays/GainVerdict';
import { HeldOutScore } from '@/components/features/replays/HeldOutScore';
import { ScoredRate } from '@/components/features/replays/ScoredRate';
import type { GainReading } from '@/lib/replay';
import {
  candidateName,
  costPerRunShown,
  heldOutShown,
  type SearchCandidate,
} from '@/lib/search';

const gainCell = (gain: GainReading | null) =>
  gain ? <GainVerdict gain={gain} /> : '–';

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
      cell: (candidate) => gainCell(candidate.searchedGain),
    },
    {
      id: 'held-out',
      header: 'Held out',
      numeric: true,
      cell: (candidate) => (
        <HeldOutScore
          rate={candidate.heldOutScore}
          interval={candidate.heldOutInterval}
          unscored={heldOutShown(candidate)}
        />
      ),
    },
    {
      id: 'held-out-gain',
      header: 'Gain on held out',
      cell: (candidate) => gainCell(candidate.heldOutGain),
    },
    {
      id: 'cost',
      header: 'Cost per run',
      numeric: true,
      cell: (candidate) => costPerRunShown(candidate.costPerRun, currency),
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
