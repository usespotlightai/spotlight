import {
  KEPT_SET_SIZE,
  type Replayable,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { NOW, STATION } from '@replays/domain/replays.fake-spec';
import type { OriginalOutcome } from '@replays/domain/services/composition';
import {
  isDueForRefresh,
  KEPT_RUN_MAX_AGE_MS,
  KEPT_SET_REFRESH_EVERY_MS,
  refreshCutoff,
  refreshOf,
  UNFILLED_SET_REFRESH_EVERY_MS,
} from '@replays/domain/services/kept-set-refresh';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1_000;

const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * DAY_MS);

const recent = (
  run: string,
  task = `task_of_${run}`,
  endedAt = NOW,
): Replayable => ({
  runId: RunId.of(run),
  taskId: TaskId.of(task),
  stationId: STATION.stationId,
  unreplayableReason: null,
  reason: null,
  endedAt,
});

const entry = (run: string, endedAt: Date, task = `task_of_${run}`) =>
  ReplaySetEntry.of({
    runId: RunId.of(run),
    taskId: TaskId.of(task),
    endedAt,
    addedAt: endedAt,
  });

const setOf = (
  entries: readonly ReplaySetEntry[] = [],
  refreshedAt: Date | null = null,
): ReplaySet =>
  ReplaySet.rehydrate({
    id: ReplaySetId.of('set_1'),
    station: STATION,
    entries,
    createdAt: daysAgo(200),
    refreshedAt,
    lastRefresh: null,
    stationGoneAt: null,
    version: 0,
  });

const outcomesOf = (
  outcomes: Record<string, OriginalOutcome>,
): ReadonlyMap<string, OriginalOutcome> => new Map(Object.entries(outcomes));

const NO_OUTCOMES = outcomesOf({});

const added = (changes: ReturnType<typeof refreshOf>) =>
  changes.add.map((each) => each.runId.value);

const removed = (changes: ReturnType<typeof refreshOf>) =>
  changes.remove.map((each) => each.value);

const runsNamed = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, at) => `${prefix}_${at}`);

describe('refreshOf', () => {
  it('fills an empty set with the newest run of each task', () => {
    const changes = refreshOf(
      setOf(),
      [
        recent('run_3', 'task_a'),
        recent('run_2', 'task_b'),
        recent('run_1', 'task_a'),
      ],
      NO_OUTCOMES,
      NOW,
    );

    expect(added(changes)).toEqual(['run_3', 'run_2']);
    expect(removed(changes)).toEqual([]);
  });

  it('evens out how the runs of the set turned out, accepted ones first', () => {
    const changes = refreshOf(
      setOf([entry('failed_0', NOW), entry('failed_1', NOW)]),
      [
        recent('failed_2'),
        recent('failed_3'),
        recent('sent_1'),
        recent('accepted_1'),
      ],
      outcomesOf({
        failed_0: 'failed',
        failed_1: 'failed',
        failed_2: 'failed',
        failed_3: 'failed',
        sent_1: 'sent-back',
        accepted_1: 'accepted',
      }),
      NOW,
    );

    expect(added(changes)).toEqual([
      'accepted_1',
      'sent_1',
      'failed_2',
      'failed_3',
    ]);
  });

  it('skips runs that cannot be replayed, worked no task or worked elsewhere', () => {
    const changes = refreshOf(
      setOf(),
      [
        {
          ...recent('unreplayable'),
          unreplayableReason: 'no-starting-point',
          reason: 'It never reported a starting point.',
        },
        { ...recent('taskless'), taskId: null },
        { ...recent('elsewhere'), stationId: 'station_ship' },
        recent('run_1'),
      ],
      NO_OUTCOMES,
      NOW,
    );

    expect(added(changes)).toEqual(['run_1']);
  });

  it('lets go of a run whose task a reflection blamed, and never takes that task back', () => {
    const changes = refreshOf(
      setOf([
        entry('run_1', NOW, 'task_blamed'),
        entry('run_2', NOW, 'task_kept'),
      ]),
      [recent('run_3', 'task_blamed'), recent('run_4', 'task_new')],
      NO_OUTCOMES,
      NOW,
      new Set(['task_blamed']),
    );

    expect(changes.remove.map((each) => each.value)).toEqual(['run_1']);
    expect(added(changes)).toEqual(['run_4']);
  });

  it('never takes a task the set covers', () => {
    const changes = refreshOf(
      setOf([entry('run_1', NOW, 'task_kept')]),
      [recent('run_2', 'task_kept'), recent('run_4', 'task_new')],
      NO_OUTCOMES,
      NOW,
    );

    expect(added(changes)).toEqual(['run_4']);
  });

  it(`lets go of runs that ended more than ${KEPT_RUN_MAX_AGE_MS / DAY_MS} days ago, oldest first`, () => {
    const changes = refreshOf(
      setOf([
        entry('young', daysAgo(10)),
        entry('old', daysAgo(91)),
        entry('older', daysAgo(120)),
        entry('at_the_limit', daysAgo(90)),
      ]),
      [],
      NO_OUTCOMES,
      NOW,
    );

    expect(removed(changes)).toEqual(['older', 'old']);
    expect(added(changes)).toEqual([]);
  });

  it('never takes a run that ended too long ago, so a retired run never comes back', () => {
    const set = setOf([entry('old', daysAgo(100), 'task_a')]);
    const old = recent('old', 'task_a', daysAgo(100));
    const changes = refreshOf(
      set,
      [old, recent('ancient', 'task_b', daysAgo(95))],
      NO_OUTCOMES,
      NOW,
    );
    const refreshed = set.refresh(changes, NOW, false);

    expect(removed(changes)).toEqual(['old']);
    expect(added(changes)).toEqual([]);
    expect(
      added(
        refreshOf(
          refreshed,
          [old],
          NO_OUTCOMES,
          new Date(NOW.getTime() + DAY_MS),
        ),
      ),
    ).toEqual([]);
  });

  it('takes a newer run of the task of a run it lets go', () => {
    const changes = refreshOf(
      setOf([entry('old', daysAgo(100), 'task_a')]),
      [recent('newer', 'task_a'), recent('old', 'task_a', daysAgo(100))],
      NO_OUTCOMES,
      NOW,
    );

    expect(removed(changes)).toEqual(['old']);
    expect(added(changes)).toEqual(['newer']);
  });

  it(`fills up to ${KEPT_SET_SIZE} runs`, () => {
    const changes = refreshOf(
      setOf(runsNamed('kept', 25).map((run) => entry(run, NOW))),
      runsNamed('recent', 10).map((run) => recent(run)),
      NO_OUTCOMES,
      NOW,
    );

    expect(added(changes)).toEqual(runsNamed('recent', 5));
    expect(removed(changes)).toEqual([]);
  });

  it('adds nothing to a full set', () => {
    const changes = refreshOf(
      setOf(runsNamed('kept', KEPT_SET_SIZE).map((run) => entry(run, NOW))),
      [recent('recent_0')],
      NO_OUTCOMES,
      NOW,
    );

    expect(changes).toEqual({ add: [], remove: [] });
  });

  it('changes nothing when no run is new', () => {
    const changes = refreshOf(
      setOf([entry('run_1', NOW)]),
      [recent('run_1')],
      NO_OUTCOMES,
      NOW,
    );

    expect(changes).toEqual({ add: [], remove: [] });
  });

  it('gives changes the set takes', () => {
    const set = setOf([entry('old', daysAgo(100)), entry('kept', daysAgo(1))]);
    const changes = refreshOf(
      set,
      [recent('new_1'), recent('new_2'), recent('kept')],
      NO_OUTCOMES,
      NOW,
    );

    expect(
      set.refresh(changes, NOW, false).runs.map((each) => each.value),
    ).toEqual(['kept', 'new_1', 'new_2']);
  });
});

describe('isDueForRefresh', () => {
  const full = runsNamed('kept', KEPT_SET_SIZE).map((run) => entry(run, NOW));
  const cutoff = refreshCutoff(NOW);

  it('makes a set never refreshed due', () => {
    expect(isDueForRefresh(setOf(), cutoff)).toBe(true);
  });

  it(`makes a full set due ${KEPT_SET_REFRESH_EVERY_MS / DAY_MS} days after its last refresh`, () => {
    expect(isDueForRefresh(setOf(full, daysAgo(6)), cutoff)).toBe(false);
    expect(isDueForRefresh(setOf(full, daysAgo(8)), cutoff)).toBe(true);
  });

  it(`makes a set that is not full due ${UNFILLED_SET_REFRESH_EVERY_MS / DAY_MS} day after its last refresh`, () => {
    const unfilled = [entry('run_1', NOW)];

    expect(isDueForRefresh(setOf(unfilled, NOW), cutoff)).toBe(false);
    expect(isDueForRefresh(setOf(unfilled, daysAgo(2)), cutoff)).toBe(true);
  });

  it('never makes a set at a gone station due', () => {
    expect(isDueForRefresh(setOf().stationLeft(NOW), cutoff)).toBe(false);
  });
});
