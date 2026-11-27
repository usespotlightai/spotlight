import { describe, expect, it } from 'vitest';

import {
  handMoveDenial,
  handMoveHint,
  mayLand,
  moveTargetFor,
  placed,
  type Task,
} from '@/lib/task';

const task = (
  id: string,
  stationId: string,
  handMoves: Task['handMoves'] = [],
): Task => ({
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
  handMoves,
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

const allowed = (stationId: string, skips: string[] = []) => ({
  stationId,
  denial: null,
  skips,
});

const denied = (
  stationId: string,
  denial: NonNullable<Task['handMoves'][number]['denial']>,
) => ({ stationId, denial, skips: [] });

describe('mayLand', () => {
  it('lets a task land only where the server says a person may move it', () => {
    const at = task('a', 'spec', [
      allowed('backlog'),
      allowed('spec'),
      denied('build', 'between-work-stations'),
      allowed('completed'),
    ]);

    expect(mayLand(at, 'backlog')).toBe(true);
    expect(mayLand(at, 'spec')).toBe(true);
    expect(mayLand(at, 'build')).toBe(false);
  });

  it('lands nothing at a station the server does not name', () => {
    expect(mayLand(task('a', 'spec'), 'elsewhere')).toBe(false);
  });
});

describe('handMoveHint', () => {
  it('names the stations a move skips', () => {
    expect(handMoveHint(allowed('build', ['spec']), stations)).toBe(
      'Skips Spec',
    );
    expect(
      handMoveHint(allowed('completed', ['spec', 'build']), stations),
    ).toBe('Skips Spec and Build');
    expect(handMoveHint(allowed('backlog'), stations)).toBeNull();
  });

  it('says why a move is not open', () => {
    expect(
      handMoveHint(denied('build', 'between-work-stations'), stations),
    ).toBe('Only runs move it here');
    expect(handMoveHint(denied('spec', 'out-of-completed'), stations)).toBe(
      'A completed task stays completed',
    );
  });
});

describe('handMoveDenial', () => {
  it('says why a task can go nowhere else', () => {
    expect(
      handMoveDenial(
        task('a', 'completed', [
          denied('backlog', 'out-of-completed'),
          denied('spec', 'out-of-completed'),
          allowed('completed'),
        ]),
      ),
    ).toBe('A completed task stays completed');
  });

  it('says nothing while some move is open', () => {
    expect(
      handMoveDenial(
        task('a', 'spec', [
          allowed('backlog'),
          denied('build', 'between-work-stations'),
        ]),
      ),
    ).toBeNull();
  });
});

describe('moveTargetFor', () => {
  it('starts work waiting in the backlog at the first work station', () => {
    expect(
      moveTargetFor(stations, [task('a', 'backlog', [allowed('spec')])], ['a'])
        ?.name,
    ).toBe('Spec');
  });

  it('parks work further along back in the backlog', () => {
    expect(
      moveTargetFor(
        stations,
        [
          task('a', 'build', [allowed('backlog')]),
          task('b', 'backlog', [allowed('backlog')]),
        ],
        ['a', 'b'],
      )?.name,
    ).toBe('Backlog');
  });

  it('offers nothing once a completed task is picked', () => {
    expect(
      moveTargetFor(
        stations,
        [
          task('a', 'build', [allowed('backlog')]),
          task('b', 'completed', [denied('backlog', 'out-of-completed')]),
        ],
        ['a', 'b'],
      ),
    ).toBeNull();
  });

  it('offers nothing until something is picked', () => {
    expect(moveTargetFor(stations, [task('a', 'build')], [])).toBeNull();
  });
});
