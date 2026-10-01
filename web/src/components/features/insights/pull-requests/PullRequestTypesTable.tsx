import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { countShown, spendShown, whyNoSpend } from '@/lib/insights';
import {
  type PullRequestAuthor,
  type TypeShare,
  typeFilter,
  typeShown,
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
      <InsightsLink tab="pull-requests" filter={typeFilter(share.type, author)}>
        {countShown(count)}
      </InsightsLink>
    ) : (
      countShown(0)
    );

  const columns: InsightsColumn<TypeShare>[] = [
    { id: 'type', header: 'Type', cell: (share) => typeShown(share.type) },
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
          spendShown(share.spend)
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
