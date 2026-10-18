import { InsightsCard } from '@/components/features/insights/InsightsCard';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { formatCount, formatShare } from '@/lib/insights';
import type { ReviewBot } from '@/lib/insights-shipping';
import { REVIEW_BOTS_NOTE } from '@/lib/insights-shipping';

const COLUMNS: readonly InsightsColumn<ReviewBot>[] = [
  {
    id: 'login',
    header: 'Agent',
    cell: (bot) => bot.login,
  },
  {
    id: 'comments',
    header: 'Comments',
    cell: (bot) => formatCount(bot.comments),
    numeric: true,
  },
  {
    id: 'reviews',
    header: 'Reviews',
    cell: (bot) => formatCount(bot.reviews),
    numeric: true,
  },
  {
    id: 'resolved',
    header: 'Resolved',
    cell: (bot) => formatShare(bot.resolvedRate),
    numeric: true,
  },
];

export function ReviewBots({ bots }: { bots: readonly ReviewBot[] }) {
  return (
    <InsightsCard
      tableOnly
      scrolls
      title="AI review agents"
      description={REVIEW_BOTS_NOTE}
    >
      <InsightsTable
        label="AI review agents"
        columns={COLUMNS}
        rows={bots}
        rowKey={(bot) => bot.login}
      />
    </InsightsCard>
  );
}
