import { CacheUse } from '@/components/features/insights/CacheUse';
import { CostSankey } from '@/components/features/insights/CostSankey';
import { CostSkeleton } from '@/components/features/insights/CostSkeleton';
import { CostSlices } from '@/components/features/insights/CostSlices';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { NoRuns } from '@/components/features/insights/NoRuns';
import {
  OVERVIEW_LAYOUT,
  PAIR_GRID,
} from '@/components/features/insights/overview-layout';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useInsightsCost } from '@/hooks/api/useInsightsCost';
import {
  formatCache,
  formatCount,
  formatSpend,
  type InsightsPeriod,
  type StationNames,
  sankeyOf,
  shownDeltaOf,
  sliceNamer,
  slicesOf,
  whyNoSpend,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';

type CostTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

export function CostTab({ slug, teamId, period, names }: CostTabProps) {
  const cost = useInsightsCost(teamId, period);
  const harnesses = useHarnesses();

  if (loading(cost) || loading(harnesses)) {
    return <CostSkeleton />;
  }

  if (failed(cost) || !cost.data) {
    return <InsightsFailed what="The cost" query={cost} />;
  }

  const { cost: breakdown, spendChange } = cost.data;
  const { spend } = breakdown;

  if (
    spend === null &&
    breakdown.unpriced === 0 &&
    !breakdown.mixedCurrencies
  ) {
    return (
      <NoRuns slug={slug} teamId={teamId} period={period}>
        Cost by harness, model, station and repository shows here once stations
        run tasks.
      </NoRuns>
    );
  }

  const named = sliceNamer(names, harnesses.data);

  return (
    <div className={OVERVIEW_LAYOUT}>
      <InsightsTiles label="Spend">
        <InsightsTile
          label="Spend"
          value={formatSpend(spend)}
          detail={spend ? undefined : whyNoSpend(breakdown.mixedCurrencies)}
          delta={shownDeltaOf(spendChange)}
          drill={{ tab: 'traces' }}
        />
        <InsightsTile
          label="Cache share"
          value={formatCache(breakdown.cache.cacheRate)}
          detail="Of tokens read"
        />
        {breakdown.unpriced > 0 && (
          <InsightsTile
            label="Runs with no price"
            value={formatCount(breakdown.unpriced)}
            detail="Their harness reports no cost"
          />
        )}
      </InsightsTiles>

      {spend && (
        <CostSankey
          shown={sankeyOf(breakdown.nodes, breakdown.links, named)}
          currency={spend.currency}
        />
      )}

      <div className={PAIR_GRID}>
        {spend ? (
          <CostSlices
            slicesOf={(dimension) => slicesOf(breakdown, dimension)}
            currency={spend.currency}
            named={named}
          />
        ) : (
          <span aria-hidden />
        )}
        <CacheUse
          slug={slug}
          teamId={teamId}
          stations={breakdown.cacheByStation}
          names={names}
        />
      </div>
    </div>
  );
}
