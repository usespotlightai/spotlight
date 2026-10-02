import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import {
  candidateName,
  costPerRunShown,
  heldOutShown,
  type SearchCandidate,
  scoreShown,
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
      cell: (candidate) =>
        `${scoreShown(candidate.searchScore)} of ${candidate.searchScored}`,
    },
    {
      id: 'held-out',
      header: 'Held out',
      numeric: true,
      cell: heldOutShown,
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
