import { Placement } from '@domain/services/placement';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { describe, expect, it } from 'vitest';

const standing = (...ranks: string[]) =>
  ranks.map((rank, at) => ({
    id: TaskId.of(`task_${at}`),
    rank: TaskRank.of(rank),
  }));

const board = standing('a', 'm', 'z');

describe('Placement', () => {
  it('puts a task above everything already standing there', () => {
    expect(Placement.atTheTop(board).value < 'a').toBe(true);
  });

  it('puts a task behind everything already standing there', () => {
    expect(Placement.atTheBack(board).value > 'z').toBe(true);
  });

  it('puts a task between the one it follows and the one under it', () => {
    const rank = Placement.below(board, board[0] ?? null).value;

    expect(rank > 'a' && rank < 'm').toBe(true);
  });

  it('follows nothing by standing first', () => {
    expect(Placement.below(board, null)).toEqual(Placement.atTheTop(board));
  });

  it('is at either end of an empty station, which is the same place', () => {
    expect(Placement.atTheTop([])).toEqual(Placement.atTheBack([]));
  });
});
