import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { chargeOf } from '@replays/domain/services/replay-charge';
import { improvedOnBestBefore } from '@replays/domain/services/search-improvement';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayEnd } from '@replays/domain/value-objects/replay-state';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const DIGEST_WAIT_MS = 15 * 60_000;

const UNCLAIMED_WAIT_MS = 60 * 60_000;

export interface SeenRun {
  readonly run: RunId;
  readonly phase: 'queued' | 'running' | 'ended';
  readonly failed: boolean;
  readonly started: boolean;
  readonly queuedAt: Date;
  readonly endedAt: Date | null;
}

const UNPRICED_RUN = ModelSpent.of([], 1);

const endOf = (replay: Replay): ReplayEnd | null =>
  replay.isDispatching ? null : (replay.current as ReplayEnd);

const withReplays = (
  search: Search,
  replays: readonly Replay[],
  known: readonly ReplayId[],
  minGain: number,
  at: Date,
  runIds: () => RunId,
): Search =>
  search.replayIds.reduce((reconciled, replayId) => {
    const replay = replays.find((each) => each.id.equals(replayId));
    const unended = reconciled.unendedReplays.some((each) =>
      each.equals(replayId),
    );

    if (!replay) {
      return unended && known.some((each) => each.equals(replayId))
        ? reconciled.recordReplayEnd(
            replayId,
            'abandoned',
            {
              spent: Spend.none(reconciled.budget.ceiling.currency),
              unpriced: 0,
            },
            at,
            runIds,
            false,
          )
        : reconciled;
    }

    const charge = chargeOf(replay);
    const end = endOf(replay);

    return end && unended
      ? reconciled.recordReplayEnd(
          replayId,
          end,
          charge,
          at,
          runIds,
          improvedOnBestBefore(reconciled, replayId, replays, minGain),
        )
      : reconciled.replaySpent(replayId, charge);
  }, search);

const past = (since: Date | null, wait: number, at: Date): boolean =>
  since !== null && at.getTime() - since.getTime() >= wait;

export const runsToSee = (search: Search): readonly RunId[] => [
  ...(search.activeRun ? [search.activeRun] : []),
  ...search.awaitingAgentSpend.map((each) => each.runId),
];

export const unclaimedTooLong = (
  search: Search,
  runs: readonly SeenRun[],
  at: Date,
): RunId | null => {
  const activeRun = search.activeRun;
  const waiting = activeRun
    ? runs.find((each) => each.run.equals(activeRun))
    : undefined;

  return activeRun &&
    waiting?.phase === 'queued' &&
    past(waiting.queuedAt, UNCLAIMED_WAIT_MS, at)
    ? activeRun
    : null;
};

export const reconciled = (
  search: Search,
  replays: readonly Replay[],
  known: readonly ReplayId[],
  runs: readonly SeenRun[],
  minGain: number,
  at: Date,
  runIds: () => RunId,
): Search => {
  let reconciled = withReplays(search, replays, known, minGain, at, runIds);
  const activeRun = reconciled.activeRun;
  const running = activeRun
    ? runs.find((each) => each.run.equals(activeRun))
    : undefined;

  if (activeRun && running?.phase === 'ended') {
    reconciled = reconciled.recordRunEnd(
      activeRun,
      { failed: running.failed, started: running.started },
      at,
      runIds,
    );
  } else if (activeRun && !running && !reconciled.isActive) {
    reconciled = reconciled.recordRunEnd(
      activeRun,
      { failed: true, started: false },
      at,
      runIds,
    );
  }

  for (const iteration of reconciled.awaitingAgentSpend) {
    const ended = runs.find((each) => each.run.equals(iteration.runId));

    if (past(ended?.endedAt ?? null, DIGEST_WAIT_MS, at)) {
      reconciled = reconciled.recordAgentSpend(
        iteration.runId,
        UNPRICED_RUN,
        at,
        runIds,
      );
    }
  }

  return reconciled;
};
