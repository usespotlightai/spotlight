import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { PullRequestTypesChart } from '@/components/features/insights/pull-requests/PullRequestTypesChart';
import { PullRequestTypesTable } from '@/components/features/insights/pull-requests/PullRequestTypesTable';
import {
  PULL_REQUEST_TYPE_SOURCE,
  SPOTLIGHT_COMPARED_WITH_PEOPLE,
  type TypeShare,
} from '@/lib/insights-pull-requests';

export function PullRequestTypes({ types }: { types: readonly TypeShare[] }) {
  return (
    <InsightsCard
      title="What Spotlight ships"
      description={`Merged pull requests by type, with Spotlight’s run cost for each type. ${SPOTLIGHT_COMPARED_WITH_PEOPLE} ${PULL_REQUEST_TYPE_SOURCE}`}
      table={<PullRequestTypesTable types={types} />}
    >
      <PullRequestTypesChart types={types} />
    </InsightsCard>
  );
}
