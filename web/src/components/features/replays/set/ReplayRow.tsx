import { Noted } from '@/components/shared/Noted';
import { NotedWarning } from '@/components/shared/NotedWarning';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { percentShown } from '@/lib/judge';
import {
  baselineTotalsFor,
  candidateShown,
  counterpartShown,
  type Replay,
  type ReplayedStation,
  replayPath,
  spendOfCeiling,
} from '@/lib/replay';
import {
  gainRangeShown,
  gainShown,
  gainVerdictShown,
  intervalShown,
  pairsJudged,
  pairTallyShown,
  repeatsShown,
  stateNote,
  stateShown,
} from '@/lib/replay-words';
import { since } from '@/lib/since';
import { cn } from '@/lib/utils';

const GAIN_TONES = {
  better: 'text-emerald-600 dark:text-emerald-400',
  worse: 'text-destructive',
  'within-noise': 'text-muted-foreground',
} as const;

type ReplayRowProps = {
  at: ReplayedStation;
  replay: Replay;
  baseline: Replay | null;
};

const gainNoteOf = (replay: Replay, baseline: Replay | null): string => {
  const gain = replay.againstBaseline;
  const against = baselineTotalsFor(replay, baseline);
  const lines = [
    gain
      ? `${gainVerdictShown(gain.verdict)}. Likely range: ${gainRangeShown(gain)} pts`
      : null,
    against?.successRate != null
      ? `Baseline: ${percentShown(against.successRate)}`
      : null,
    replay.pairedWith && pairsJudged(replay.pairsAgainstBaseline)
      ? `Side by side with ${counterpartShown(replay.pairedWith, replay.candidate, baseline?.id ?? null)}: ${pairTallyShown(replay.pairsAgainstBaseline)}`
      : null,
  ];

  return lines.filter(Boolean).join(' · ');
};

function Gain({ replay, baseline }: Omit<ReplayRowProps, 'at'>) {
  if (replay.isBaseline) {
    return <span className="text-muted-foreground">Baseline</span>;
  }

  const gain = replay.againstBaseline;

  if (!gain) {
    return <span className="text-muted-foreground">–</span>;
  }

  return (
    <Noted note={gainNoteOf(replay, baseline)}>
      <span className={GAIN_TONES[gain.verdict]}>{gainShown(gain)}</span>
    </Noted>
  );
}

export function ReplayRow({ at, replay, baseline }: ReplayRowProps) {
  const { successRate, interval, unscored } = replay.totals;
  const running = replay.state === 'running' || replay.state === 'queued';
  const note = stateNote(replay.state);

  return (
    <li data-slot="replay" className={cn(TABLE_ROW, ROW_DIVIDER)}>
      <span className={cn(LEAD_CELL, EDGE_INDENT)}>
        <TrailLink
          to={replayPath(at, replay.id)}
          className="truncate font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {candidateShown(replay.candidate)}
        </TrailLink>
        {replay.repeats > 1 && (
          <span className="shrink-0 text-muted-foreground">
            {repeatsShown(replay.repeats)}
          </span>
        )}
      </span>
      <NestedCell heading="State" numeric={false}>
        <span
          title={note ?? undefined}
          className={cn(
            running && 'text-foreground',
            replay.state === 'over-budget' && 'text-destructive',
          )}
        >
          {stateShown(replay.state)}
        </span>
      </NestedCell>
      <NestedCell heading="Success" strong>
        <span className="inline-flex items-center justify-end gap-1.5">
          {unscored > 0 && (
            <NotedWarning
              tone="muted"
              label={`${unscored} unscored`}
              note={`${unscored} of its runs have no score yet.`}
              className="relative z-10"
            />
          )}
          {successRate === null ? (
            <span className="text-muted-foreground">–</span>
          ) : interval ? (
            <Noted note={`Likely range: ${intervalShown(interval)}`}>
              <span className="relative z-10">{percentShown(successRate)}</span>
            </Noted>
          ) : (
            percentShown(successRate)
          )}
        </span>
      </NestedCell>
      <NestedCell heading="Gain">
        <span className="relative z-10">
          <Gain replay={replay} baseline={baseline} />
        </span>
      </NestedCell>
      <NestedCell heading="Spent">
        {spendOfCeiling(replay.totals.spent, replay.ceiling)}
      </NestedCell>
      <NestedCell heading="Started">{since(replay.startedAt)}</NestedCell>
    </li>
  );
}
