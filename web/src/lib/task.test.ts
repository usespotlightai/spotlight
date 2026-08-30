import { describe, expect, it } from 'vitest';
import { placed, type Task } from '@/lib/task';

const task = (id: string, stationId: string): Task => ({
  id,
  stationId,
  title: id,
  description: null,
  createdAt: '2026-08-04T09:15:00.000Z',
  running: false,
  awaitingReview: false,
  note: null,
});

const board = [task('a', 'triage'), task('b', 'triage'), task('c', 'spec')];

const titles = (tasks: readonly Task[]) =>
  tasks.map((each) => `${each.id}@${each.stationId}`);

describe('placed', () => {
  it('drops a task after the one it was let go over', () => {
    expect(titles(placed(board, 'a', 'triage', 'b'))).toEqual([
      'b@triage',
      'a@triage',
      'c@spec',
    ]);
  });

  it('drops a task at the top of its station when it follows nothing', () => {
    expect(titles(placed(board, 'b', 'triage', null))).toEqual([
      'b@triage',
      'a@triage',
      'c@spec',
    ]);
  });

  it('carries a task into another station', () => {
    expect(titles(placed(board, 'a', 'spec', 'c'))).toEqual([
      'b@triage',
      'c@spec',
      'a@spec',
    ]);
  });

  it('lands at the top of an empty station', () => {
    expect(titles(placed(board, 'a', 'review', null))).toEqual([
      'b@triage',
      'c@spec',
      'a@review',
    ]);
  });

  it('leaves the board alone for a task it does not hold', () => {
    expect(titles(placed(board, 'missing', 'triage', null))).toEqual(
      titles(board),
    );
  });
});
