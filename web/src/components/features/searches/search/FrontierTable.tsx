import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { GainWithPairs } from '@/components/features/replays/GainWithPairs';
import { HeldOutScore } from '@/components/features/replays/HeldOutScore';
import { ScoredRate } from '@/components/features/replays/ScoredRate';
import { CandidateIcons } from '@/components/features/searches/CandidateIcons';
import { RegressionCount } from '@/components/features/searches/search/RegressionCount';
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
  maxRegressions: number | null;
};

export function FrontierTable({
  candidates,
  currency,
  maxRegressions,
}: FrontierTableProps) {
  const columns: InsightsColumn<SearchCandidate>[] = [
    {
      id: 'candidate',
      header: 'Candidate',
      cell: (candidate) => (
        <span className="inline-flex items-center gap-1.5">
          {candidateName(candidate)}
          <CandidateIcons
            candidate={candidate}
            frontier={candidate.onFrontier}
            maxRegressions={maxRegressions}
          />
        </span>
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
      id: 'regressions',
      header: 'Regressions',
      numeric: true,
      cell: (candidate) => (
        <RegressionCount regressions={candidate.regressions} />
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
