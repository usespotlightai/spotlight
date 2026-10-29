import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { CandidateIcons } from '@/components/features/searches/CandidateIcons';
import { CandidateRate } from '@/components/features/searches/search/CandidateRate';
import { formatRunsScored, NOT_SCORED_YET } from '@/lib/replay-words';
import {
  candidateName,
  formatCostPerRun,
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
      id: 'success',
      header: 'Success rate',
      numeric: true,
      cell: (candidate) =>
        candidate.searchScored === 0 || candidate.searchScore === null ? (
          <span className="text-muted-foreground">{NOT_SCORED_YET}</span>
        ) : (
          <CandidateRate
            rate={candidate.searchScore}
            interval={candidate.searchInterval}
            more={formatRunsScored(candidate.searchScored)}
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
