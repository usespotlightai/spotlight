import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { baselineRepeatsFor } from '@replays/domain/value-objects/replay-repeats';
import { ReusedReplays } from '@replays/domain/value-objects/reused-replays.vo';
import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

interface ReuseInput {
  readonly runs: readonly RunId[];
  readonly repeats: number;
  readonly candidate: StationHashes;
  readonly live: StationHashes;
  readonly replays: readonly Replay[];
  readonly configs: ReadonlyMap<string, StationHashes>;
}

const newestFirst = (one: Replay, other: Replay): number =>
  other.startedAt.getTime() - one.startedAt.getTime();

const coveredIn = (
  replays: readonly Replay[],
  runs: readonly RunId[],
): ReadonlyMap<string, { readonly replay: Replay; readonly run: RunId }> => {
  const covered = new Map<string, { replay: Replay; run: RunId }>();

  for (const replay of [...replays].sort(newestFirst)) {
    for (const run of replay.originals) {
      if (!covered.has(run.value) && runs.some((each) => each.equals(run))) {
        covered.set(run.value, { replay, run });
      }
    }
  }

  return covered;
};

export const reusedOf = (input: ReuseInput): ReusedReplays | null => {
  const runsAs = (replay: Replay, hashes: StationHashes): boolean =>
    replay.scoringHash === hashes.scoring &&
    (input.configs.get(replay.candidateId.value)?.runsAs(hashes) ?? false);
  const reusable = input.replays.filter(
    (each) =>
      !each.baseline &&
      each.searchId !== null &&
      each.current === 'finished' &&
      each.repeats === input.repeats &&
      each.pairwiseReferenceId !== null &&
      runsAs(each, input.candidate),
  );
  const seeds = input.replays.filter(
    (each) =>
      each.baseline &&
      each.current === 'finished' &&
      each.repeats >= baselineRepeatsFor(input.repeats) &&
      input.runs.every((run) =>
        each.originals.some((one) => one.equals(run)),
      ) &&
      runsAs(each, input.live),
  );
  let best: {
    readonly seed: Replay;
    readonly covered: ReturnType<typeof coveredIn>;
  } | null = null;

  for (const seed of [...seeds].sort(newestFirst)) {
    const covered = coveredIn(
      reusable.filter((each) => each.pairwiseReferenceId?.equals(seed.id)),
      input.runs,
    );

    if (covered.size > (best?.covered.size ?? 0)) {
      best = { seed, covered };
    }
  }

  if (!best) {
    return null;
  }

  const parts = new Map<string, { replay: Replay; runs: RunId[] }>();

  for (const { replay, run } of best.covered.values()) {
    const part = parts.get(replay.id.value) ?? { replay, runs: [] };

    part.runs.push(run);
    parts.set(replay.id.value, part);
  }

  return ReusedReplays.of({
    seed: best.seed.id,
    parts: [...parts.values()].map((each) => ({
      replayId: each.replay.id,
      runs: each.runs,
    })),
  });
};
