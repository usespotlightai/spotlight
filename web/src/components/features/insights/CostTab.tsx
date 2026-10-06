import { CacheUse } from '@/components/features/insights/CacheUse';
import { CostSankey } from '@/components/features/insights/CostSankey';
import { CostSkeleton } from '@/components/features/insights/CostSkeleton';
import { CostSlices } from '@/components/features/insights/CostSlices';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { TruncatedNote } from '@/components/features/insights/TruncatedNote';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useInsightsCost } from '@/hooks/api/useInsightsCost';
import {
  COST_DIMENSIONS,
  cacheShown,
  countShown,
  deltaOf,
  type InsightsPeriod,
  type StationNames,
  sankeyOf,
  sliceNamer,
  slicesOf,
  spendShown,
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
  const harnesses = useHarnesses().data;

  if (loading(cost)) {
    return <CostSkeleton />;
  }

  if (failed(cost) || !cost.data) {
    return <InsightsFailed what="The cost" query={cost} />;
  }

  const {
    cost: breakdown,
    spendBefore,
    mixedCurrenciesBefore,
    truncated,
  } = cost.data;
  const { spend } = breakdown;

  if (
    spend === null &&
    breakdown.unpriced === 0 &&
    !breakdown.mixedCurrencies
  ) {
    return (
      <NoRunsInPeriod slug={slug} teamId={teamId}>
        Cost by harness, model, station and repository shows here once stations
        run tasks.
      </NoRunsInPeriod>
    );
  }

  const named = sliceNamer(names, harnesses);

  return (
    <div className="flex flex-col gap-3">
      {truncated && <TruncatedNote />}

      <InsightsTiles label="Spend">
        <InsightsTile
          label="Spend"
          value={spendShown(spend)}
          detail={spend ? undefined : whyNoSpend(breakdown.mixedCurrencies)}
          delta={
            spend &&
            spendBefore &&
            !mixedCurrenciesBefore &&
            spendBefore.currency === spend.currency
              ? deltaOf(spend.amount, spendBefore.amount, 'neither')
              : null
          }
          drill={{ tab: 'runs' }}
        />
        <InsightsTile
          label="Runs with no price"
          value={countShown(breakdown.unpriced)}
          detail="Harness reports no cost"
        />
        <InsightsTile
          label="Cache share"
          value={cacheShown(breakdown.cache.cacheShare)}
          detail="Of input tokens, read from cache"
        />
      </InsightsTiles>

      {spend && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {COST_DIMENSIONS.map((dimension) => (
              <CostSlices
                key={dimension.id}
                title={dimension.label}
                dimension={dimension.id}
                slices={slicesOf(breakdown, dimension.id)}
                currency={spend.currency}
                named={named}
              />
            ))}
          </div>

          <CostSankey
            shown={sankeyOf(breakdown.nodes, breakdown.links, named)}
            currency={spend.currency}
          />
        </>
      )}

      <CacheUse
        slug={slug}
        teamId={teamId}
        stations={breakdown.cacheByStation}
        names={names}
      />
    </div>
  );
}
