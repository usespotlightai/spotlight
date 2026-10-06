import type { UseQueryResult } from '@tanstack/react-query';
import { JudgeStandings } from '@/components/features/insights/changes/JudgeStandings';
import { ReplayedOverlayNote } from '@/components/features/insights/changes/ReplayedOverlayNote';
import { ReplayedSetupTable } from '@/components/features/insights/changes/ReplayedSetupTable';
import { SetupFilters } from '@/components/features/insights/changes/SetupFilters';
import { SetupScatter } from '@/components/features/insights/changes/SetupScatter';
import { SetupTable } from '@/components/features/insights/changes/SetupTable';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import type { SetupsNarrowed } from '@/hooks/api/useInsightsSetups';
import type { StationNames } from '@/lib/insights';
import {
  type InsightsCandidates,
  stationReplayedChart,
} from '@/lib/insights-candidates';
import {
  type InsightsSetups,
  lowerIsBetter,
  type OutcomeMeasure,
  outcomeLabel,
  setupPoints,
  sizeRuleShown,
} from '@/lib/insights-changes';

type SetupComparisonProps = {
  slug: string;
  setups: InsightsSetups;
  candidates: UseQueryResult<InsightsCandidates>;
  teamId: string;
  narrowed: SetupsNarrowed;
  measure: OutcomeMeasure;
  names: StationNames;
  onNarrow: (narrowed: SetupsNarrowed) => void;
  onMeasure: (measure: OutcomeMeasure) => void;
};

export function SetupComparison({
  slug,
  teamId,
  setups,
  candidates,
  narrowed,
  measure,
  names,
  onNarrow,
  onMeasure,
}: SetupComparisonProps) {
  const harnesses = useHarnesses().data;
  const judged = setups.setups.some((each) => (each.judge?.judged ?? 0) > 0);
  const points = setupPoints(
    setups.setups,
    measure,
    harnesses,
    setups.currency,
  );
  const chart =
    narrowed.stationId && candidates.data
      ? stationReplayedChart(
          candidates.data,
          narrowed.stationId,
          setups.currency,
        )
      : null;
  const hiddenFor = lowerIsBetter(measure) ? outcomeLabel(measure) : null;
  const replayed = hiddenFor ? [] : (chart?.priced ?? []);
  const scattered =
    setups.setups.length > 0 && points.length > 0 && Boolean(setups.currency);
  const drawn = scattered && replayed.length > 0;

  const filters = (
    <SetupFilters
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
      data-slot="setup-notes"
      className="flex flex-wrap items-start gap-x-8 gap-y-1 border-border border-t pt-2 empty:hidden"
    >
      <ReplayedOverlayNote
        stationId={narrowed.stationId}
        chart={chart}
        drawn={chartShown && drawn}
        scattered={scattered}
        hiddenFor={hiddenFor}
        candidates={candidates}
      />

      <JudgeStandings
        slug={slug}
        teamId={teamId}
        judges={setups.judges}
        names={names}
      />
    </div>
  );

  return (
    <InsightsCard
      title="Harness, model, effort and profile"
      description={`${outcomeLabel(measure)} against cost per run.${drawn ? ' Replayed points show replay success on past tasks.' : ''} The frontier joins setups no other matches for less. Minimum runs per setup: ${setups.fewestRuns}. Task size, by a run’s changes: ${setups.sizes.map(sizeRuleShown).join('; ')}.`}
      table={
        <>
          {filters}
          <SetupTable
            setups={setups.setups}
            measure={measure}
            harnesses={harnesses}
            judged={judged}
          />
          {replayed.length > 0 && setups.currency && (
            <ReplayedSetupTable points={replayed} currency={setups.currency} />
          )}
          {notes(false)}
        </>
      }
    >
      {filters}

      {setups.setups.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No runs match these filters in this period.
        </p>
      ) : !scattered || !setups.currency ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No priced runs to chart. Show the table for outcomes alone.
        </p>
      ) : (
        <SetupScatter
          points={points}
          replayed={replayed}
          measure={measure}
          currency={setups.currency}
        />
      )}

      {notes(true)}
    </InsightsCard>
  );
}
