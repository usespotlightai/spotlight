import { describe, expect, it } from 'vitest';

import {
  mayLand,
  movableByHand,
  moveTargetFor,
  placed,
  holdsOnMessage,
  startsAgainOnMessage,
  type Task,
} from '@/lib/task';

const task = (id: string, stationId: string): Task => ({
  id,
  stationId,
  revision: 0,
  title: id,
  description: null,
  attachments: [],
  createdAt: '2026-08-04T09:15:00.000Z',
  progress: null,
  awaitingReview: null,
  finished: false,
  createdBy: null,
  assignee: null,
  pullRequests: [],
  note: null,
  source: null,
  hold: null,
  runNotStarted: null,
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

  it('leaves the board alone for a task it does not have', () => {
    expect(titles(placed(board, 'missing', 'triage', null))).toEqual(
      titles(board),
    );
  });
});

const backlog = { id: 'backlog', name: 'Backlog', kind: 'backlog' } as const;
const spec = { id: 'spec', name: 'Spec', kind: 'work' } as const;
const build = { id: 'build', name: 'Build', kind: 'work' } as const;
const completed = {
  id: 'completed',
  name: 'Completed',
  kind: 'completed',
} as const;
const stations = [backlog, spec, build, completed];

describe('movableByHand', () => {
  it('starts work from the backlog at any work station', () => {
    expect(movableByHand(backlog, spec)).toBe(true);
    expect(movableByHand(backlog, build)).toBe(true);
  });

  it('closes work from anywhere that is not already completed', () => {
    expect(movableByHand(backlog, completed)).toBe(true);
    expect(movableByHand(build, completed)).toBe(true);
  });

  it('parks work from a work station back in the backlog', () => {
    expect(movableByHand(build, backlog)).toBe(true);
  });

  it('reorders work within the station it is at', () => {
    expect(movableByHand(spec, spec)).toBe(true);
    expect(movableByHand(completed, completed)).toBe(true);
  });

  it('leaves passing work between work stations to its runs', () => {
    expect(movableByHand(spec, build)).toBe(false);
    expect(movableByHand(build, spec)).toBe(false);
  });

  it('keeps completed work completed', () => {
    expect(movableByHand(completed, backlog)).toBe(false);
    expect(movableByHand(completed, spec)).toBe(false);
  });
});

describe('mayLand', () => {
  it('lets a task land only where a person may move it', () => {
    expect(mayLand(stations, task('a', 'spec'), 'backlog', undefined)).toBe(
      true,
    );
    expect(mayLand(stations, task('a', 'spec'), 'build', undefined)).toBe(
      false,
    );
  });

  const held: Task = {
    ...task('a', 'spec'),
    hold: {
      by: { id: 'user_1', name: 'Leon', image: null },
      startedAt: '2026-08-04T09:15:00.000Z',
      runId: null,
      heldMoveTo: null,
      chatId: null,
    },
  };

  it('keeps a task on hold at its station for everyone but the person who holds it', () => {
    expect(mayLand(stations, held, 'backlog', 'user_2')).toBe(false);
    expect(mayLand(stations, held, 'spec', 'user_2')).toBe(true);
  });

  it('lets the person who holds the task move it, which resumes the line', () => {
    expect(mayLand(stations, held, 'backlog', 'user_1')).toBe(true);
  });

  it('lands nothing at a station off the line', () => {
    expect(mayLand(stations, task('a', 'spec'), 'elsewhere', undefined)).toBe(
      false,
    );
  });
});

describe('moveTargetFor', () => {
  it('starts work waiting in the backlog at the first work station', () => {
    expect(
      moveTargetFor(stations, [task('a', 'backlog')], ['a'], undefined)?.name,
    ).toBe('Spec');
  });

  it('parks work further along back in the backlog', () => {
    expect(
      moveTargetFor(
        stations,
        [task('a', 'build'), task('b', 'backlog')],
        ['a', 'b'],
        undefined,
      )?.name,
    ).toBe('Backlog');
  });

  it('offers nothing once a completed task is picked', () => {
    expect(
      moveTargetFor(
        stations,
        [task('a', 'build'), task('b', 'completed')],
        ['a', 'b'],
        undefined,
      ),
    ).toBeNull();
  });

  it('offers nothing until something is picked', () => {
    expect(
      moveTargetFor(stations, [task('a', 'build')], [], undefined),
    ).toBeNull();
  });
});

describe('startsAgainOnMessage', () => {
  const worked = { id: 'spec', harness: 'claude-code' };
  const finished: Task = { ...task('a', 'spec'), finished: true };

  it('starts a finished task again at the station its run worked', () => {
    expect(startsAgainOnMessage(finished, worked, 'spec')).toBe(true);
  });

  it('leaves a task that is not finished to the hold', () => {
    expect(startsAgainOnMessage(task('a', 'spec'), worked, 'spec')).toBe(false);
  });

  it('starts nothing from a run at a station the task has since left', () => {
    expect(startsAgainOnMessage(finished, worked, 'triage')).toBe(false);
  });

  it('leaves a task that still has a current run to that run', () => {
    expect(
      startsAgainOnMessage(
        { ...finished, progress: 'in-progress' },
        worked,
        'spec',
      ),
    ).toBe(false);
  });

  it('leaves a task waiting on a person to the answer', () => {
    expect(
      startsAgainOnMessage(
        { ...finished, awaitingReview: { conversationId: 'a:0' } },
        worked,
        'spec',
      ),
    ).toBe(false);
  });

  it('starts nothing where nothing runs', () => {
    expect(
      startsAgainOnMessage(
        task('a', 'backlog'),
        { id: 'backlog', harness: null },
        'backlog',
      ),
    ).toBe(false);
  });
});

describe('holdsOnMessage', () => {
  const worked = { id: 'spec', harness: 'claude-code' };

  it('puts a task on hold at the station its run worked', () => {
    expect(holdsOnMessage(task('a', 'spec'), worked, 'spec')).toBe(true);
  });

  it('puts a task on hold while the line runs it', () => {
    expect(
      holdsOnMessage(
        { ...task('a', 'spec'), progress: 'in-progress' },
        worked,
        'spec',
      ),
    ).toBe(true);
  });

  it('does not hold a task that is on hold already', () => {
    expect(
      holdsOnMessage(
        {
          ...task('a', 'spec'),
          hold: {
            by: { id: 'user_1', name: 'Leon', image: null },
            startedAt: '2026-08-04T09:15:00.000Z',
            runId: null,
            heldMoveTo: null,
            chatId: null,
          },
        },
        worked,
        'spec',
      ),
    ).toBe(false);
  });

  it('does not hold a finished task', () => {
    expect(
      holdsOnMessage({ ...task('a', 'spec'), finished: true }, worked, 'spec'),
    ).toBe(false);
  });

  it('does not hold a task from a run at a station it has left', () => {
    expect(holdsOnMessage(task('a', 'spec'), worked, 'triage')).toBe(false);
  });
});
