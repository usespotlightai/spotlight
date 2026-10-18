import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { SpotlightShareChart } from '@/components/features/insights/pull-requests/SpotlightShareChart';
import { SpotlightShareTable } from '@/components/features/insights/pull-requests/SpotlightShareTable';
import { formatCount, formatShare } from '@/lib/insights';
import {
  type InsightsPullRequests,
  mergedPullRequestsFilter,
} from '@/lib/insights-pull-requests';

type SpotlightShareProps = {
  spotlightShare: InsightsPullRequests['spotlightShare'];
};

export function SpotlightShare({ spotlightShare }: SpotlightShareProps) {
  const drill = (filter: Parameters<typeof mergedPullRequestsFilter>[0]) => ({
    tab: 'productivity' as const,
    filter: mergedPullRequestsFilter(filter),
  });

  return (
    <div className="flex flex-col gap-3">
      <InsightsTiles label="Merged pull requests">
        <InsightsTile
          label="PRs merged"
          value={formatCount(spotlightShare.merged)}
          detail="In the team’s repositories"
          drill={drill({})}
        />
        <InsightsTile
          label="Made by Spotlight"
          value={formatCount(spotlightShare.authored)}
          drill={drill({ author: 'spotlight' })}
        />
        <InsightsTile
          label="Reviewed by Spotlight"
          value={formatCount(spotlightShare.reviewed)}
          detail="Others’ pull requests with a Spotlight review task"
          drill={drill({ author: 'reviewed' })}
        />
        <InsightsTile
          label="Spotlight’s share"
          value={formatShare(spotlightShare.rate)}
          detail="Share of all merged pull requests that Spotlight made or reviewed. Bots’ pull requests count."
        />
      </InsightsTiles>

      <InsightsCard
        title="Week by week"
        description="Merged pull requests each week, by who made them: Spotlight, others with a Spotlight review task, people alone, bots alone."
        table={
          <SpotlightShareTable weeks={spotlightShare.weeks} repository={null} />
        }
      >
        <SpotlightShareChart weeks={spotlightShare.weeks} />
      </InsightsCard>
    </div>
  );
}
