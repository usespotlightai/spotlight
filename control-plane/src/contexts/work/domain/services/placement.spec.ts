import { Placement } from '@work/domain/services/placement';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { describe, expect, it } from 'vitest';

const ranksOf = (...values: string[]) =>
  values.map((rank) => TaskRank.of(rank));

const board = ranksOf('a', 'm', 'z');

describe('Placement', () => {
  it('queues an opened task and a task passed on behind everything already there', () => {
    expect(Placement.entering('opened', board).value > 'z').toBe(true);
    expect(Placement.entering('passed-on', board).value > 'z').toBe(true);
  });

  it('puts a deferred move and a reaction above everything already there', () => {
    expect(Placement.entering('deferred', board).value < 'a').toBe(true);
    expect(Placement.entering('reacted', board).value < 'a').toBe(true);
  });

  it('puts a task between the one it follows and the one under it', () => {
    const rank = Placement.below(board, board[0] ?? null).value;

    expect(rank > 'a' && rank < 'm').toBe(true);
  });

  it('puts a task behind the last one it follows', () => {
    expect(Placement.below(board, board[2] ?? null).value > 'z').toBe(true);
  });

  it('follows nothing by going first', () => {
    expect(Placement.below(board, null)).toEqual(
      Placement.entering('reacted', board),
    );
  });

  it('is at either end of an empty station, which is the same place', () => {
    expect(Placement.entering('reacted', [])).toEqual(
      Placement.entering('opened', []),
    );
  });
});
