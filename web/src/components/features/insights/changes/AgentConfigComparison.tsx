import type { UseQueryResult } from '@tanstack/react-query';
import { AgentConfigFilters } from '@/components/features/insights/changes/AgentConfigFilters';
import { AgentConfigScatter } from '@/components/features/insights/changes/AgentConfigScatter';
import { AgentConfigTable } from '@/components/features/insights/changes/AgentConfigTable';
import { JudgeCalibrations } from '@/components/features/insights/changes/JudgeCalibrations';
import { ReplayedAgentConfigTable } from '@/components/features/insights/changes/ReplayedAgentConfigTable';
import { ReplayedOverlayNote } from '@/components/features/insights/changes/ReplayedOverlayNote';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import type { AgentConfigsNarrowed } from '@/hooks/api/useInsightsAgentConfigs';
import type { StationNames } from '@/lib/insights';
import {
  type InsightsCandidates,
  stationReplayedPoints,
} from '@/lib/insights-candidates';
import {
  agentConfigPoints,
  formatSizeRule,
  type InsightsAgentConfigs,
  lowerIsBetter,
  type OutcomeMeasure,
  outcomeLabel,
} from '@/lib/insights-changes';

type AgentConfigComparisonProps = {
  slug: string;
  comparison: InsightsAgentConfigs;
  candidates: UseQueryResult<InsightsCandidates>;
  teamId: string;
  narrowed: AgentConfigsNarrowed;
  measure: OutcomeMeasure;
  names: StationNames;
  onNarrow: (narrowed: AgentConfigsNarrowed) => void;
  onMeasure: (measure: OutcomeMeasure) => void;
};

export function AgentConfigComparison({
  slug,
  teamId,
  comparison,
  candidates,
  narrowed,
  measure,
  names,
  onNarrow,
  onMeasure,
}: AgentConfigComparisonProps) {
  const harnesses = useHarnesses().data;
  const judged = comparison.agentConfigs.some(
    (each) => (each.judge?.judged ?? 0) > 0,
  );
  const points = agentConfigPoints(comparison.agentConfigs, measure, harnesses);
  const stationReplayed =
    narrowed.stationId && candidates.data
      ? stationReplayedPoints(
          candidates.data,
          narrowed.stationId,
          comparison.currency,
        )
      : null;
  const hiddenFor = lowerIsBetter(measure) ? outcomeLabel(measure) : null;
  const replayed = hiddenFor ? [] : (stationReplayed ?? []);
  const scattered =
    comparison.agentConfigs.length > 0 &&
    points.length > 0 &&
    Boolean(comparison.currency);
  const drawn = scattered && replayed.length > 0;

  const filters = (
    <AgentConfigFilters
      narrowed={narrowed}
      measure={measure}
      judged={judged}
      names={names}
      onNarrow={onNarrow}
      onMeasure={onMeasure}
    />
  );

  const notes = (chartShown: boolean) => (
    <div
      data-slot="agent-config-notes"
      className="flex flex-wrap items-start gap-x-8 gap-y-1 border-border border-t pt-2 empty:hidden"
    >
      <ReplayedOverlayNote
        stationId={narrowed.stationId}
        replayed={stationReplayed}
        drawn={chartShown && drawn}
        scattered={scattered}
        hiddenFor={hiddenFor}
        candidates={candidates}
      />

      <JudgeCalibrations
        slug={slug}
        teamId={teamId}
        judges={comparison.judges}
        names={names}
      />
    </div>
  );

  return (
    <InsightsCard
      title="Harness, model, effort and profile"
      description={`${outcomeLabel(measure)} against cost per run.${drawn ? ' Replayed points show replay success on past tasks.' : ''} The frontier joins agent configs no other matches for less. Minimum runs per agent config: ${comparison.minRuns}. Task size, by a run’s changes: ${comparison.sizes.map(formatSizeRule).join('; ')}.`}
      actions={filters}
      table={
        <>
          <AgentConfigTable
            agentConfigs={comparison.agentConfigs}
            measure={measure}
            harnesses={harnesses}
            judged={judged}
          />
          {replayed.length > 0 && comparison.currency && (
            <ReplayedAgentConfigTable
              points={replayed}
              currency={comparison.currency}
            />
          )}
          {notes(false)}
        </>
      }
    >
      {comparison.agentConfigs.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No runs match these filters in this period.
        </p>
      ) : !scattered || !comparison.currency ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No priced runs to chart. Show the table for outcomes alone.
        </p>
      ) : (
        <AgentConfigScatter
          points={points}
          replayed={replayed}
          measure={measure}
          currency={comparison.currency}
        />
      )}

      {notes(true)}
    </InsightsCard>
  );
}
