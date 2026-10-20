import { describe, expect, it } from 'vitest';
import {
  mayLand,
  movableByHand,
  moveTargetFor,
  placed,
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
  work: null,
  awaitingReview: null,
  createdBy: null,
  assignee: null,
  pullRequest: null,
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
    expect(mayLand(stations, task('a', 'spec'), 'backlog')).toBe(true);
    expect(mayLand(stations, task('a', 'spec'), 'build')).toBe(false);
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

describe('startsAgainOnMessage', () => {
  const worked = { id: 'spec', harness: 'claude-code' };

  it('starts a task idle at the station its run worked again', () => {
    expect(startsAgainOnMessage(task('a', 'spec'), worked, 'spec')).toBe(true);
  });

  it('starts nothing from a run at a station the task has since left', () => {
    expect(startsAgainOnMessage(task('a', 'spec'), worked, 'triage')).toBe(
      false,
    );
  });

  it('leaves a task that still has a current run to that run', () => {
    expect(
      startsAgainOnMessage(
        { ...task('a', 'spec'), work: 'in-progress' },
        worked,
        'spec',
      ),
    ).toBe(false);
  });

  it('leaves a task waiting on a person to the answer', () => {
    expect(
      startsAgainOnMessage(
        { ...task('a', 'spec'), awaitingReview: { conversationId: 'a:0' } },
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
