import {
  KEPT_SET_SIZE,
  type Replayable,
  type ReplaySet,
  type ReplaySetChanges,
} from '@replays/domain/aggregates/replay-set.aggregate';
import {
  balancingPicks,
  newestOfEachTask,
} from '@replays/domain/services/balancing-picks';
import {
  type OriginalOutcome,
  originalOutcomeOf,
} from '@replays/domain/services/composition';

const DAY_MS = 24 * 60 * 60 * 1_000;

export const KEPT_RUN_MAX_AGE_MS = 90 * DAY_MS;

export const KEPT_SET_REFRESH_EVERY_MS = 7 * DAY_MS;

export const UNFILLED_SET_REFRESH_EVERY_MS = DAY_MS;

export const KEPT_SET_PICKED_FROM = 100;

export interface RefreshCutoff {
  readonly before: Date;
  readonly unfilledBefore: Date;
  readonly size: number;
}

export const refreshCutoff = (at: Date): RefreshCutoff => ({
  before: new Date(at.getTime() - KEPT_SET_REFRESH_EVERY_MS),
  unfilledBefore: new Date(at.getTime() - UNFILLED_SET_REFRESH_EVERY_MS),
  size: KEPT_SET_SIZE,
});

export const isDueForRefresh = (
  set: ReplaySet,
  cutoff: RefreshCutoff,
): boolean =>
  !set.isAtGoneStation &&
  (set.refreshedAt === null ||
    set.refreshedAt < cutoff.before ||
    (set.entries.length < cutoff.size &&
      set.refreshedAt < cutoff.unfilledBefore));

interface Pickable {
  readonly run: Replayable;
  readonly task: string;
  readonly outcome: OriginalOutcome;
}

const isTooOld = (endedAt: Date, at: Date): boolean =>
  at.getTime() - endedAt.getTime() > KEPT_RUN_MAX_AGE_MS;

const filled = (
  setOutcomes: readonly OriginalOutcome[],
  newestFirst: readonly Pickable[],
  room: number,
): readonly Pickable[] => {
  const outcomes = [...setOutcomes];
  const left = [...newestFirst];
  const picks: Pickable[] = [];

  while (picks.length < room && left.length > 0) {
    const [balancing] = balancingPicks(outcomes, left, 1);
    const picked = balancing ?? left[0];

    left.splice(left.indexOf(picked), 1);
    picks.push(picked);
    outcomes.push(picked.outcome);
  }

  return picks;
};

export const refreshOf = (
  set: ReplaySet,
  recent: readonly Replayable[],
  outcomes: ReadonlyMap<string, OriginalOutcome>,
  at: Date,
  taskCaused: ReadonlySet<string> = new Set(),
): ReplaySetChanges => {
  const retired = [...set.entries]
    .filter(
      (each) => isTooOld(each.endedAt, at) || taskCaused.has(each.taskId.value),
    )
    .sort((one, other) => one.endedAt.getTime() - other.endedAt.getTime());
  const kept = set.entries.filter((each) => !retired.includes(each));
  const pickable = newestOfEachTask(
    recent.flatMap((run) =>
      run.unreplayableReason === null &&
      run.taskId !== null &&
      run.stationId === set.station.stationId &&
      !taskCaused.has(run.taskId.value) &&
      !isTooOld(run.endedAt, at)
        ? [
            {
              run,
              task: run.taskId.value,
              outcome: originalOutcomeOf(outcomes, run.runId.value),
            },
          ]
        : [],
    ),
    kept.map((each) => each.taskId.value),
  );
  const added = filled(
    kept.map((each) => originalOutcomeOf(outcomes, each.runId.value)),
    pickable,
    KEPT_SET_SIZE - kept.length,
  );

  return {
    add: added.map((each) => each.run),
    remove: retired.map((each) => each.runId),
  };
};
