import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { ClaimAgreements } from '@/components/features/stations/judge/ClaimAgreements';
import { ConfusionMatrix } from '@/components/features/stations/judge/ConfusionMatrix';
import { JudgeStatistics } from '@/components/features/stations/judge/JudgeStatistics';
import { JudgeTrend } from '@/components/features/stations/judge/JudgeTrend';
import { ScoreDistribution } from '@/components/features/stations/judge/ScoreDistribution';
import {
  comparisonStats,
  type RubricVersion,
  scoreDistribution,
} from '@/lib/judge';

const CENTERED = 'flex flex-1 items-center justify-center pb-8';

type RubricVersionCardProps = {
  version: RubricVersion;
  claims: readonly string[];
  trust: number | null;
};

export function RubricVersionCard({
  version,
  claims,
  trust,
}: RubricVersionCardProps) {
  const { agreement } = version;

  return (
    <div data-slot="rubric-version" className="@container flex flex-col gap-2">
      <div className="grid auto-rows-[minmax(23rem,auto)] gap-2 @2xl:grid-cols-2 @6xl:grid-cols-4">
        <InsightsCard title="Statistics">
          <div className={CENTERED}>
            <JudgeStatistics stats={comparisonStats(version)} />
          </div>
        </InsightsCard>

        {agreement.pairs > 0 && (
          <InsightsCard title="Score comparison">
            <div className={CENTERED}>
              <ConfusionMatrix confusion={version.confusion} />
            </div>
          </InsightsCard>
        )}

        {agreement.pairs > 0 && (
          <InsightsCard
            title="Distribution"
            description="How often each score was given, on runs with both scores."
          >
            <ScoreDistribution counts={scoreDistribution(version.confusion)} />
          </InsightsCard>
        )}

        {version.trend.length > 0 && (
          <InsightsCard title="Trend over time">
            <JudgeTrend trend={version.trend} kind={version.kind} />
          </InsightsCard>
        )}
      </div>

      {agreement.claims.length > 0 && (
        <InsightsCard title="By claim">
          <ClaimAgreements
            agreements={agreement.claims}
            claims={claims}
            trust={trust}
          />
        </InsightsCard>
      )}
    </div>
  );
}
