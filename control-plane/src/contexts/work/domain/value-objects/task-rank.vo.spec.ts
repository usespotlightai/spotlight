import { InvalidTaskRankError } from '@work/domain/exceptions/invalid-task-rank.error';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { describe, expect, it } from 'vitest';

const between = (before: string | null, after: string | null) =>
  TaskRank.between(
    before === null ? null : TaskRank.of(before),
    after === null ? null : TaskRank.of(after),
  ).value;

describe('TaskRank', () => {
  it('opens a first rank when the station is empty', () => {
    const first = between(null, null);

    expect(first.length).toBeGreaterThan(0);
  });

  it('sits after the last task when dropped at the end', () => {
    const last = between('i', null);

    expect(last > 'i').toBe(true);
  });

  it('sits before the first task when dropped at the top', () => {
    const first = between(null, 'i');

    expect(first < 'i').toBe(true);
  });

  it('sits between two neighbours', () => {
    const middle = between('a', 'b');

    expect(middle > 'a').toBe(true);
    expect(middle < 'b').toBe(true);
  });

  it('finds room between neighbours that are already adjacent', () => {
    let low = 'a';
    const high = 'b';

    for (let each = 0; each < 40; each += 1) {
      const next = between(low, high);

      expect(next > low).toBe(true);
      expect(next < high).toBe(true);
      low = next;
    }
  });

  it('keeps a whole shuffled station in order', () => {
    const ranks = ['a', between('a', null)];
    ranks.push(between(ranks[0] as string, ranks[1] as string));

    expect([...ranks].sort()).toEqual([ranks[0], ranks[2], ranks[1]]);
  });

  it('refuses neighbours given the wrong way round', () => {
    expect(() => between('b', 'a')).toThrow(InvalidTaskRankError);
  });

  it('refuses a rank that is not a rank', () => {
    expect(() => TaskRank.of('NOPE!')).toThrow(InvalidTaskRankError);
  });
});
