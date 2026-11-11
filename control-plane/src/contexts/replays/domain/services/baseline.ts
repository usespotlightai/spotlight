import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplayState } from '@replays/domain/value-objects/replay-state';
import type { ScoringHash } from '@replays/domain/value-objects/scoring-hash.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const VALID_BASELINE_STATES = [
  'queued',
  'running',
  'finished',
] as const satisfies readonly ReplayState[];

const VALID: readonly string[] = VALID_BASELINE_STATES;

const newestFirst = (
  one: { readonly startedAt: Date },
  other: { readonly startedAt: Date },
): number => other.startedAt.getTime() - one.startedAt.getTime();

const covers = (
  baseline: Replay,
  runs: readonly RunId[],
  repeats: number,
): boolean =>
  baseline.repeats >= repeats &&
  runs.every((run) => baseline.originals.some((each) => each.equals(run)));

interface BaselineServing {
  readonly servesAsBaseline: boolean;
  readonly startedAt: Date;
}

export const servingBaselineOf = <T extends BaselineServing>(
  replays: readonly T[],
): T | null =>
  [...replays].filter((each) => each.servesAsBaseline).sort(newestFirst)[0] ??
  null;

export const baselineFor = (
  replays: readonly Replay[],
  liveScoring: ScoringHash,
  runs: readonly RunId[],
  repeats: number,
): Replay | null => {
  const matching = [...replays]
    .filter(
      (each) =>
        each.baseline &&
        each.scoringHash === liveScoring &&
        covers(each, runs, repeats),
    )
    .sort(newestFirst);

  return (
    matching.find((each) => each.current === 'finished') ??
    matching.find((each) => VALID.includes(each.current)) ??
    matching[0] ??
    null
  );
};

export const currentBaselineFor = (
  set: ReplaySet,
  replays: readonly Replay[],
  liveScoring: ScoringHash,
  repeats: number,
): Replay | null =>
  baselineFor(
    replays.filter((each) => VALID.includes(each.current)),
    liveScoring,
    set.runs,
    repeats,
  );

export const needsBaseline = (
  set: ReplaySet,
  replays: readonly Replay[],
  liveScoring: ScoringHash,
  repeats: number,
): boolean => !currentBaselineFor(set, replays, liveScoring, repeats);
