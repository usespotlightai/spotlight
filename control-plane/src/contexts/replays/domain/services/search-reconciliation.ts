import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type {
  RunEnding,
  Search,
} from '@replays/domain/aggregates/search.aggregate';
import { chargeOf } from '@replays/domain/services/replay-charge';
import { improvedOnBestBefore } from '@replays/domain/services/search-improvement';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { RunResult } from '@replays/domain/value-objects/replay-ending';
import type { ReplayStopReason } from '@replays/domain/value-objects/replay-state';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const SUCCEEDED: Readonly<Record<RunResult, boolean>> = {
  completed: true,
  failed: false,
  exhausted: false,
  cancelled: false,
};

const USAGE_WAIT_MS = 15 * 60_000;

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

const endOf = (replay: Replay): ReplayStopReason | null =>
  replay.isDispatching ? null : (replay.current as ReplayStopReason);

const withReplays = (
  search: Search,
  replays: readonly Replay[],
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
      const awaitsStart = reconciled.replaysAwaitingStart.some((each) =>
        each.equals(replayId),
      );

      return unended && !awaitsStart
        ? reconciled.recordReplayStopReason(
            replayId,
            'deleted',
            {
              spent: Money.none(reconciled.budget.ceiling.currency),
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
    const started = reconciled.replayStarted(replayId);

    return end && unended
      ? started.recordReplayStopReason(
          replayId,
          end,
          charge,
          at,
          runIds,
          improvedOnBestBefore(
            started,
            replayId,
            replays.map((each) => each.outcome()),
            minGain,
          ),
        )
      : started.replaySpent(replayId, charge);
  }, search);

const past = (since: Date | null, wait: number, at: Date): boolean =>
  since !== null && at.getTime() - since.getTime() >= wait;

export const searchRunEnding = (ended: {
  readonly outcome: RunResult;
  readonly asked: boolean;
  readonly started: boolean;
}): RunEnding => ({
  failed: !SUCCEEDED[ended.outcome] || ended.asked,
  started: ended.started,
});

const RUN_STATES = [
  'queued',
  'claimed',
  'suspended',
  'completed',
  'failed',
  'cancelled',
] as const;

export type RunState = (typeof RUN_STATES)[number];

export interface SearchRunFact {
  readonly run: RunId;
  readonly state: RunState;
  readonly askedAPerson: boolean;
  readonly started: boolean;
  readonly queuedAt: Date;
  readonly endedAt: Date | null;
}

const PHASE: Readonly<Record<RunState, SeenRun['phase']>> = {
  queued: 'queued',
  claimed: 'running',
  suspended: 'running',
  completed: 'ended',
  failed: 'ended',
  cancelled: 'ended',
};

const ENDED_AS: Readonly<Record<RunState, RunResult | null>> = {
  queued: null,
  claimed: null,
  suspended: null,
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
};

export const seenRunOf = (fact: SearchRunFact): SeenRun => {
  const result = ENDED_AS[fact.state];

  return {
    run: fact.run,
    phase: PHASE[fact.state],
    failed:
      result === null ||
      searchRunEnding({
        outcome: result,
        asked: fact.askedAPerson,
        started: fact.started,
      }).failed,
    started: fact.started,
    queuedAt: fact.queuedAt,
    endedAt: fact.endedAt,
  };
};

export const cancelledUnclaimed = (
  runs: readonly SeenRun[],
  unclaimed: RunId,
  started: boolean,
  at: Date,
): readonly SeenRun[] =>
  runs.map((each) =>
    each.run.equals(unclaimed)
      ? { ...each, phase: 'ended', failed: true, started, endedAt: at }
      : each,
  );

export const runsToSee = (search: Search): readonly RunId[] => [
  ...(search.activeRun ? [search.activeRun] : []),
  ...search.awaitingAgentSpend.flatMap((each) =>
    each.runId ? [each.runId] : [],
  ),
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
  runs: readonly SeenRun[],
  minGain: number,
  at: Date,
  runIds: () => RunId,
): Search => {
  let reconciled = withReplays(search, replays, minGain, at, runIds);
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

  for (const { runId } of reconciled.awaitingAgentSpend) {
    const ended = runId && runs.find((each) => each.run.equals(runId));

    if (runId && past(ended?.endedAt ?? null, USAGE_WAIT_MS, at)) {
      reconciled = reconciled.recordAgentSpend(runId, UNPRICED_RUN, at, runIds);
    }
  }

  return reconciled;
};
