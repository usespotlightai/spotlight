import { taskRowsOf } from '@replays/application/rendering/task-rows';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { aSet, replayedAs, replayFor } from '@replays/domain/replays.fake-spec';
import { taskComparisons } from '@replays/domain/services/replay-results';
import type { RunResult } from '@replays/domain/value-objects/replay-ending';
import { describe, expect, it } from 'vitest';

const SET = aSet(4);

const failingOn =
  (...originals: string[]) =>
  (original: string): RunResult =>
    originals.includes(original) ? 'failed' : 'completed';

const live = (): Replay =>
  replayedAs(
    replayFor(SET, 'replay_live', 'candidate_live', null, true),
    failingOn('original_3'),
  );

const candidate = (): Replay =>
  replayedAs(
    replayFor(SET, 'replay_candidate', 'candidate_one', null),
    failingOn('original_1'),
  );

const TITLES = new Map<string, string | null>([
  ['original_0', 'Drain the queue'],
  ['original_1', 'Keep the order'],
]);

const rowsOf = (theirs: Replay | null, ours = candidate()) =>
  taskRowsOf(
    taskComparisons(ours, theirs),
    { candidate: ours.scoring, live: theirs?.scoring ?? null },
    TITLES,
  );

describe('taskRowsOf', () => {
  it('gives each task both sides with a reason in one line, the regressed and lost tasks first', () => {
    const rows = rowsOf(live());

    expect(rows.map((each) => each.originalRunId)).toEqual([
      'original_1',
      'original_0',
      'original_2',
      'original_3',
    ]);
    expect(rows[0]).toMatchObject({
      title: 'Keep the order',
      regressed: true,
      live: { result: 'succeeded', successRate: 1 },
      candidate: { result: 'failed', successRate: 0 },
    });
    expect(rows[3]).toMatchObject({
      title: null,
      live: { result: 'failed' },
      candidate: { result: 'succeeded' },
    });
    for (const each of rows) {
      for (const side of [each.live, each.candidate]) {
        expect(side.reason).toMatch(/^[A-Z].*\.$/);
        expect(side.reason).not.toContain('\n');
      }
    }
    expect(rows[0]?.candidate.reason).toMatch(/^The run failed/);
  });

  it('says a side did not replay the task, or has not finished', () => {
    const rows = rowsOf(
      null,
      replayFor(SET, 'replay_running', 'candidate_one', null),
    );

    expect(rows[0]?.live).toEqual({
      result: 'absent',
      successRate: null,
      reason: 'Not replayed.',
    });
    expect(rows[0]?.candidate).toEqual({
      result: 'pending',
      successRate: null,
      reason: 'The replay has not finished.',
    });
  });
});
