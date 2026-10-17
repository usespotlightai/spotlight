import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { PenetrationChart } from '@/components/features/insights/pull-requests/PenetrationChart';
import { PenetrationTable } from '@/components/features/insights/pull-requests/PenetrationTable';
import { formatCount, formatShare } from '@/lib/insights';
import {
  type InsightsPullRequests,
  mergedPullRequestsFilter,
  WEEK_BY_WEEK_NOTE,
} from '@/lib/insights-pull-requests';

type PenetrationProps = {
  penetration: InsightsPullRequests['penetration'];
};

export function Penetration({ penetration }: PenetrationProps) {
  const drill = (filter: Parameters<typeof mergedPullRequestsFilter>[0]) => ({
    tab: 'productivity' as const,
    filter: mergedPullRequestsFilter(filter),
  });

  return (
    <div className="flex flex-col gap-3">
      <InsightsTiles label="Merged pull requests">
        <InsightsTile
          label="PRs merged"
          value={formatCount(penetration.merged)}
          detail="In the team’s repositories"
          drill={drill({})}
        />
        <InsightsTile
          label="Made by Spotlight"
          value={formatCount(penetration.made)}
          drill={drill({ author: 'spotlight' })}
        />
        <InsightsTile
          label="Reviewed by Spotlight"
          value={formatCount(penetration.touched)}
          detail="Others’ pull requests with a Spotlight review task"
          drill={drill({ author: 'touched' })}
        />
        <InsightsTile
          label="Spotlight’s share"
          value={formatShare(penetration.share)}
          detail="Share of all merged pull requests that Spotlight made or reviewed. Bots’ pull requests count."
        />
      </InsightsTiles>

      <InsightsCard
        title="Week by week"
        description={WEEK_BY_WEEK_NOTE}
        table={<PenetrationTable weeks={penetration.weeks} repository={null} />}
      >
        <PenetrationChart weeks={penetration.weeks} />
      </InsightsCard>
    </div>
  );
}
