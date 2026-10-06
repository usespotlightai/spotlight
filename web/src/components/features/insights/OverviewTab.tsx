import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { OutputAgainstCost } from '@/components/features/insights/OutputAgainstCost';
import { OverviewSkeleton } from '@/components/features/insights/OverviewSkeleton';
import { TruncatedNote } from '@/components/features/insights/TruncatedNote';
import { WorthImprovingList } from '@/components/features/insights/WorthImprovingList';
import { useInsightsOverview } from '@/hooks/api/useInsightsOverview';
import {
  headlineTiles,
  type InsightsPeriod,
  outputDays,
  type StationNames,
  whyNoSpend,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';

type OverviewTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

export function OverviewTab({ slug, teamId, period, names }: OverviewTabProps) {
  const overview = useInsightsOverview(teamId, period);

  if (loading(overview)) {
    return <OverviewSkeleton />;
  }

  if (failed(overview) || !overview.data) {
    return <InsightsFailed what="The overview" query={overview} />;
  }

  const {
    headline,
    before,
    output,
    outputCurrency,
    outputMixedCurrencies,
    configChanges,
    worthImproving,
    truncated,
  } = overview.data;

  if (headline.runs === 0 && headline.mergedPullRequests === 0) {
    return (
      <NoRunsInPeriod slug={slug} teamId={teamId}>
        Cost and delivery show here once stations run tasks.
      </NoRunsInPeriod>
    );
  }

  const trends: Record<string, number[]> = {
    spend: output.map((day) => day.spend?.amount ?? 0),
    merged: output.map((day) => day.merged),
  };

  return (
    <div className="flex flex-col gap-3">
      {truncated && <TruncatedNote />}

      <InsightsTiles label="Headline numbers">
        {headlineTiles(headline, before).map((tile) => (
          <InsightsTile
            key={tile.id}
            label={tile.label}
            value={tile.value}
            detail={tile.detail}
            delta={tile.delta}
            drill={tile.drill}
            trend={trends[tile.id]}
          />
        ))}
      </InsightsTiles>

      <OutputAgainstCost
        slug={slug}
        teamId={teamId}
        days={outputDays(output, configChanges)}
        currency={outputCurrency}
        noSpend={whyNoSpend(outputMixedCurrencies)}
        names={names}
      />

      <WorthImprovingList
        slug={slug}
        teamId={teamId}
        stations={worthImproving}
        names={names}
      />
    </div>
  );
}
