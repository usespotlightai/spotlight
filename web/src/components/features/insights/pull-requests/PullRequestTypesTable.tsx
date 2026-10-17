import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { formatCount, formatSpend, whyNoSpend } from '@/lib/insights';
import {
  formatType,
  type PullRequestAuthor,
  type TypeShare,
  typeFilter,
} from '@/lib/insights-pull-requests';

export function PullRequestTypesTable({
  types,
}: {
  types: readonly TypeShare[];
}) {
  const counted = (
    share: TypeShare,
    author: PullRequestAuthor,
    count: number,
  ) =>
    count > 0 ? (
      <InsightsLink tab="productivity" filter={typeFilter(share.type, author)}>
        {formatCount(count)}
      </InsightsLink>
    ) : (
      formatCount(0)
    );

  const columns: InsightsColumn<TypeShare>[] = [
    { id: 'type', header: 'Type', cell: (share) => formatType(share.type) },
    {
      id: 'spotlight',
      header: 'Spotlight’s',
      numeric: true,
      cell: (share) => counted(share, 'spotlight', share.spotlight),
    },
    {
      id: 'people',
      header: 'People’s alone',
      numeric: true,
      cell: (share) => counted(share, 'people', share.people),
    },
    {
      id: 'spend',
      header: 'Spotlight spent',
      numeric: true,
      cell: (share) =>
        share.spend || share.spotlight === 0 ? (
          formatSpend(share.spend)
        ) : (
          <span title={whyNoSpend(share.mixedCurrencies)}>–</span>
        ),
    },
  ];

  return (
    <InsightsTable
      label="Merged pull requests by type"
      columns={columns}
      rows={types}
      rowKey={(share) => share.type}
    />
  );
}
