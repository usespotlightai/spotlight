import type { ReactElement } from 'react';

import { InsightsTableSkeleton } from '@/components/features/insights/InsightsTableSkeleton';

const HEADERS = [
  'Pull request',
  'Repository',
  'Written by',
  'Type',
  'State',
  'Opened',
  'To merge',
  'In review',
  'Rounds',
  'Comments',
  'Size',
  'Cost',
];

export function PullRequestListSkeleton(): ReactElement {
  return (
    <InsightsTableSkeleton
      label="Loading the pull request list"
      headers={HEADERS}
      rows={8}
    />
  );
}
