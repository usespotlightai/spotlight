import { describe, expect, it } from 'vitest';

import {
  mayLand,
  movableByHand,
  moveTargetFor,
  placed,
  sendsBack,
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
  waitingForYou: false,
  yourMessage: 'message',
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

describe('sendsBack', () => {
  const routed = (
    station: { id: string; kind: 'backlog' | 'work' | 'completed' },
    position: number,
    passesTo: string[] = [],
  ) => ({ ...station, position, passesTo });
  const review = routed({ id: 'review', kind: 'work' }, 3, ['build']);

  it('sends work back to an earlier work station, or one its station passes to', () => {
    expect(sendsBack(review, routed(build, 2))).toBe(true);
    expect(sendsBack(review, routed(spec, 1))).toBe(true);
    expect(sendsBack(routed(spec, 1, ['review']), review)).toBe(true);
  });

  it('sends nothing on to a later station it does not pass to, nor out of the work stations', () => {
    expect(sendsBack(routed(spec, 1), review)).toBe(false);
    expect(sendsBack(review, review)).toBe(false);
    expect(sendsBack(review, routed(backlog, 0))).toBe(false);
    expect(sendsBack(review, routed(completed, 4))).toBe(false);
    expect(sendsBack(routed(backlog, 0), routed(spec, 1))).toBe(false);
  });
});

describe('mayLand', () => {
  it('lets a task land only where a person may move it', () => {
    expect(mayLand(stations, task('a', 'spec'), 'backlog')).toBe(true);
    expect(mayLand(stations, task('a', 'spec'), 'build')).toBe(false);
  });

  const held: Task = {
    ...task('a', 'spec'),
    hold: {
      by: { id: 'user_1', name: 'Leon', image: null },
      startedAt: '2026-08-04T09:15:00.000Z',
      runId: null,
      heldMoveTo: null,
      chatId: null,
      viewerDrives: true,
      viewerEnds: true,
    },
  };

  it('lets a person who may end the hold move the task, which resumes the line', () => {
    expect(mayLand(stations, held, 'backlog')).toBe(true);
  });

  it('keeps a task on hold at its station for a person who may not end the hold', () => {
    const locked: Task = {
      ...held,
      hold: held.hold && {
        ...held.hold,
        viewerDrives: false,
        viewerEnds: false,
      },
    };

    expect(mayLand(stations, locked, 'backlog')).toBe(false);
    expect(mayLand(stations, locked, 'spec')).toBe(true);
  });

  it('lands nothing at a station off the line', () => {
    expect(mayLand(stations, task('a', 'spec'), 'elsewhere')).toBe(false);
  });
});

describe('moveTargetFor', () => {
  it('starts work waiting in the backlog at the first work station', () => {
    expect(moveTargetFor(stations, [task('a', 'backlog')], ['a'])?.name).toBe(
      'Spec',
    );
  });

  it('parks work further along back in the backlog', () => {
    expect(
      moveTargetFor(
        stations,
        [task('a', 'build'), task('b', 'backlog')],
        ['a', 'b'],
      )?.name,
    ).toBe('Backlog');
  });

  it('offers nothing once a completed task is picked', () => {
    expect(
      moveTargetFor(
        stations,
        [task('a', 'build'), task('b', 'completed')],
        ['a', 'b'],
      ),
    ).toBeNull();
  });

  it('offers nothing until something is picked', () => {
    expect(moveTargetFor(stations, [task('a', 'build')], [])).toBeNull();
  });
});
