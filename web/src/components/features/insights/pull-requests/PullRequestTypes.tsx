import type { ReactElement } from 'react';

import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { PullRequestTypesChart } from '@/components/features/insights/pull-requests/PullRequestTypesChart';
import { PullRequestTypesTable } from '@/components/features/insights/pull-requests/PullRequestTypesTable';
import { TYPES_NOTE, type TypeShare } from '@/lib/insights-pull-requests';

export function PullRequestTypes({
  types,
}: {
  types: readonly TypeShare[];
}): ReactElement {
  return (
    <InsightsCard
      flat
      title="What Spotlight ships"
      description={TYPES_NOTE}
      table={<PullRequestTypesTable types={types} />}
    >
      <PullRequestTypesChart types={types} />
    </InsightsCard>
  );
}
