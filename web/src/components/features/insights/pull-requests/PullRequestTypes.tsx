import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { PullRequestTypesChart } from '@/components/features/insights/pull-requests/PullRequestTypesChart';
import { PullRequestTypesTable } from '@/components/features/insights/pull-requests/PullRequestTypesTable';
import type { TypeShare } from '@/lib/insights-pull-requests';

export function PullRequestTypes({ types }: { types: readonly TypeShare[] }) {
  return (
    <InsightsCard
      title="What Spotlight ships"
      description="Merged pull requests by type, with Spotlight’s run cost per type. Spotlight’s against people’s alone, in repositories Spotlight merged into. Type from: change stack, else title and branch"
      table={<PullRequestTypesTable types={types} />}
    >
      <PullRequestTypesChart types={types} />
    </InsightsCard>
  );
}
