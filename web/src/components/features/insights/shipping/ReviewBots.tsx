import { InsightsCard } from '@/components/features/insights/InsightsCard';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { countShown, shareShown } from '@/lib/insights';
import type { ReviewBot } from '@/lib/insights-shipping';

const COLUMNS: readonly InsightsColumn<ReviewBot>[] = [
  {
    id: 'login',
    header: 'Agent',
    cell: (bot) => bot.login,
  },
  {
    id: 'comments',
    header: 'Comments',
    cell: (bot) => countShown(bot.comments),
    numeric: true,
  },
  {
    id: 'reviews',
    header: 'Reviews',
    cell: (bot) => countShown(bot.reviews),
    numeric: true,
  },
  {
    id: 'resolved',
    header: 'Resolved',
    cell: (bot) => shareShown(bot.resolvedShare),
    numeric: true,
  },
];

export function ReviewBots({ bots }: { bots: readonly ReviewBot[] }) {
  return (
    <InsightsCard
      tableOnly
      title="AI review agents"
      description="Bots that reviewed the team’s pull requests. Spotlight’s review tasks count. Resolved: share of their comments resolved before merge"
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
