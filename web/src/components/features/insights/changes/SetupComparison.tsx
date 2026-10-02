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
  judgeWithheldShown,
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
  const withheld = judgeWithheldShown(setups.judgeWithheld);
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
    <>
      <ReplayedOverlayNote
        stationId={narrowed.stationId}
        chart={chart}
        drawn={chartShown && drawn}
        scattered={scattered}
        hiddenFor={hiddenFor}
        priced={setups.currency !== null}
        candidates={candidates}
      />

      <p className="text-muted-foreground text-xs">
        Task size, by a run’s changes:{' '}
        {setups.sizes.map(sizeRuleShown).join('; ')}.
      </p>

      {withheld && (
        <p data-slot="judge-withheld" className="text-muted-foreground text-xs">
          {withheld}
        </p>
      )}

      <JudgeStandings
        slug={slug}
        teamId={teamId}
        judges={setups.judges}
        names={names}
      />
    </>
  );

  return (
    <InsightsCard
      title="Harness, model, effort and profile"
      description={`${outcomeLabel(measure)} against cost per run${drawn ? '; replayed points show replay success on past tasks instead' : ''}. The frontier joins the setups no other did as well or better than for less, among those with ${setups.fewestRuns} runs or more.`}
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
          No priced runs to set against their cost. Show the table for the
          outcomes alone.
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
