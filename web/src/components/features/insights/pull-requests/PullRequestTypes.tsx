import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { PullRequestTypesChart } from '@/components/features/insights/pull-requests/PullRequestTypesChart';
import { PullRequestTypesTable } from '@/components/features/insights/pull-requests/PullRequestTypesTable';
import type { TypeShare } from '@/lib/insights-pull-requests';

export function PullRequestTypes({ types }: { types: readonly TypeShare[] }) {
  return (
    <InsightsCard
      title="What Spotlight ships"
      description="Merged pull requests by type, Spotlight’s against people’s alone in the repositories Spotlight merged into, with what Spotlight’s runs cost for each. A type comes from the change stack where there is one, or else from the title and branch."
      table={<PullRequestTypesTable types={types} />}
    >
      <PullRequestTypesChart types={types} />
    </InsightsCard>
  );
}
