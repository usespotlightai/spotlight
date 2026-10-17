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
import { formatPercent } from '@/lib/judge';
import {
  counterpartRateOf,
  formatCandidate,
  formatCounterpart,
  type Replay,
  type ReplayedStation,
  replayPath,
  spendOfCeiling,
} from '@/lib/replay';
import {
  BASELINE_LABEL,
  formatGain,
  formatGainRange,
  formatGainVerdict,
  formatInterval,
  formatPairTally,
  formatRepeats,
  formatState,
  pairsJudged,
  stateNote,
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
  baselineId: string | null;
};

const gainNoteOf = (replay: Replay, baselineId: string | null): string => {
  const gain = replay.againstBaseline;
  const against = counterpartRateOf(replay, baselineId);
  const lines = [
    gain
      ? `${formatGainVerdict(gain.verdict)}. Likely range: ${formatGainRange(gain)} pts`
      : null,
    against?.successRate != null
      ? `${against.label}: ${formatPercent(against.successRate)}`
      : null,
    replay.pairedWith && pairsJudged(replay.pairsAgainstBaseline)
      ? `Side by side with ${formatCounterpart(replay.pairedWith, replay.candidate, baselineId)}: ${formatPairTally(replay.pairsAgainstBaseline)}`
      : null,
  ];

  return lines.filter(Boolean).join(' · ');
};

function Gain({ replay, baselineId }: Omit<ReplayRowProps, 'at'>) {
  if (replay.isBaseline) {
    return <span className="text-muted-foreground">{BASELINE_LABEL}</span>;
  }

  const gain = replay.againstBaseline;

  if (!gain) {
    return <span className="text-muted-foreground">–</span>;
  }

  return (
    <Noted note={gainNoteOf(replay, baselineId)}>
      <span className={GAIN_TONES[gain.verdict]}>{formatGain(gain)}</span>
    </Noted>
  );
}

export function ReplayRow({ at, replay, baselineId }: ReplayRowProps) {
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
          {formatCandidate(replay.candidate)}
        </TrailLink>
        {replay.repeats > 1 && (
          <span className="shrink-0 text-muted-foreground">
            {formatRepeats(replay.repeats)}
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
          {formatState(replay.state)}
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
            <Noted note={`Likely range: ${formatInterval(interval)}`}>
              <span className="relative z-10">
                {formatPercent(successRate)}
              </span>
            </Noted>
          ) : (
            formatPercent(successRate)
          )}
        </span>
      </NestedCell>
      <NestedCell heading="Gain">
        <span className="relative z-10">
          <Gain replay={replay} baselineId={baselineId} />
        </span>
      </NestedCell>
      <NestedCell heading="Spent">
        {spendOfCeiling(replay.totals.spent, replay.ceiling)}
      </NestedCell>
      <NestedCell heading="Started">{since(replay.startedAt)}</NestedCell>
    </li>
  );
}
