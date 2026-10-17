import type { OriginalOutcome } from '@replays/domain/services/composition';
import {
  balancingPicks,
  MAX_SUGGESTED,
  newestOfEachTask,
} from '@replays/domain/services/set-suggestions';
import { describe, expect, it } from 'vitest';

const run = (id: string, outcome: OriginalOutcome) => ({ id, outcome });

const held = (outcome: OriginalOutcome, count: number): OriginalOutcome[] =>
  Array.from({ length: count }, () => outcome);

const ids = (picks: readonly { id: string }[]) => picks.map((each) => each.id);

describe('balancingPicks', () => {
  it('evens a set of failures with accepted runs first, then sent back ones, newest first', () => {
    expect(
      ids(
        balancingPicks(
          held('failed', 6),
          [
            run('failed_1', 'failed'),
            run('sent_1', 'sent-back'),
            run('accepted_1', 'accepted'),
            run('accepted_2', 'accepted'),
            run('sent_2', 'sent-back'),
            run('accepted_3', 'accepted'),
          ],
          MAX_SUGGESTED,
        ),
      ),
    ).toEqual(['accepted_1', 'sent_1', 'accepted_2', 'sent_2', 'accepted_3']);
  });

  it('picks the outcome the set has fewest of before the one it prefers', () => {
    expect(
      ids(
        balancingPicks(
          [...held('failed', 4), ...held('accepted', 2)],
          [run('accepted_1', 'accepted'), run('asked_1', 'asked')],
          MAX_SUGGESTED,
        ),
      ),
    ).toEqual(['asked_1', 'accepted_1']);
  });

  it('stops once no outcome is short of the most common one', () => {
    expect(
      ids(
        balancingPicks(
          [...held('failed', 2), 'accepted'],
          [
            run('accepted_1', 'accepted'),
            run('accepted_2', 'accepted'),
            run('accepted_3', 'accepted'),
          ],
          MAX_SUGGESTED,
        ),
      ),
    ).toEqual(['accepted_1']);
  });

  it('never suggests a run that turned out some other way, nor more of the most common outcome', () => {
    expect(
      balancingPicks(
        held('failed', 3),
        [run('other_1', 'other'), run('failed_1', 'failed')],
        MAX_SUGGESTED,
      ),
    ).toEqual([]);
  });

  it('suggests nothing for a balanced set or an empty one', () => {
    const recent = [run('accepted_1', 'accepted'), run('failed_1', 'failed')];

    expect(
      balancingPicks(['accepted', 'failed'], recent, MAX_SUGGESTED),
    ).toEqual([]);
    expect(balancingPicks([], recent, MAX_SUGGESTED)).toEqual([]);
  });

  it('suggests no more than it is asked for', () => {
    expect(
      balancingPicks(
        held('failed', 10),
        [
          run('accepted_1', 'accepted'),
          run('accepted_2', 'accepted'),
          run('accepted_3', 'accepted'),
        ],
        2,
      ),
    ).toHaveLength(2);
  });
});

describe('newestOfEachTask', () => {
  it('keeps only the newest run of each task, and none of a task the set holds', () => {
    expect(
      newestOfEachTask(
        [
          { id: 'run_3', task: 'task_a' },
          { id: 'run_2', task: 'task_b' },
          { id: 'run_1', task: 'task_a' },
          { id: 'run_0', task: 'task_held' },
        ],
        ['task_held'],
      ).map((each) => each.id),
    ).toEqual(['run_3', 'run_2']);
  });
});
