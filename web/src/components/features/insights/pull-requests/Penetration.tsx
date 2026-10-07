import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { PenetrationChart } from '@/components/features/insights/pull-requests/PenetrationChart';
import { PenetrationTable } from '@/components/features/insights/pull-requests/PenetrationTable';
import { countShown, shareShown } from '@/lib/insights';
import {
  type InsightsPullRequests,
  mergedPullRequestsFilter,
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
          value={countShown(penetration.merged)}
          detail="In the team’s repositories"
          drill={drill({})}
        />
        <InsightsTile
          label="Made by Spotlight"
          value={countShown(penetration.made)}
          drill={drill({ author: 'spotlight' })}
        />
        <InsightsTile
          label="Reviewed by Spotlight"
          value={countShown(penetration.touched)}
          detail="Others’ with a Spotlight review task"
          drill={drill({ author: 'touched' })}
        />
        <InsightsTile
          label="Spotlight’s share"
          value={shareShown(penetration.share)}
          detail="Made or reviewed by Spotlight, of all merged, bots’ included"
        />
      </InsightsTiles>

      <InsightsCard
        title="Week by week"
        description="Merged pull requests each week: made by Spotlight, others’ with a Spotlight review task, people alone, bots alone."
        table={<PenetrationTable weeks={penetration.weeks} repository={null} />}
      >
        <PenetrationChart weeks={penetration.weeks} />
      </InsightsCard>
    </div>
  );
}
