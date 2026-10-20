import type { TaskNoteKind } from '@work/domain/entities/task-note.entity';
import {
  awaitsAPerson,
  conversationsOf,
  notesIn,
  pendingIn,
  reviewsIn,
  stillOpen,
  threadAt,
} from '@work/domain/services/conversations';
import { describe, expect, it } from 'vitest';

const trail = (...kinds: TaskNoteKind[]) => conversationsOf(kinds);

describe('conversationsOf', () => {
  it('finds nothing in a trail nobody was asked about', () => {
    expect(trail('passed', 'passed')).toEqual([]);
  });

  it('opens at the asking and closes at the moving on', () => {
    expect(trail('passed', 'asked', 'answered', 'passed')).toEqual([
      { from: 1, to: 3 },
    ]);
  });

  it('leaves the last one open where nothing has closed it', () => {
    expect(trail('asked', 'answered')).toEqual([{ from: 0, to: null }]);
  });

  it('takes a follow-up as the same conversation carrying on', () => {
    expect(trail('asked', 'answered', 'asked')).toEqual([
      { from: 0, to: null },
    ]);
  });

  it('opens a second one only after the first has closed', () => {
    expect(trail('asked', 'passed', 'asked')).toEqual([
      { from: 0, to: 1 },
      { from: 2, to: null },
    ]);
  });

  it('ignores a moving on that closed nothing', () => {
    expect(trail('passed', 'asked', 'passed', 'passed')).toEqual([
      { from: 1, to: 2 },
    ]);
  });
});

describe('stillOpen', () => {
  it('is open while nothing has closed it', () => {
    expect(stillOpen({ from: 0, to: null })).toBe(true);
  });

  it('does not once something has', () => {
    expect(stillOpen({ from: 0, to: 2 })).toBe(false);
  });
});

describe('notesIn', () => {
  const trail = ['a', 'b', 'c', 'd'];

  it('covers the note that opened it through the one that closed it', () => {
    expect(notesIn({ from: 1, to: 2 }, trail)).toEqual(['b', 'c']);
  });

  it('runs to the end of the trail while it is still open', () => {
    expect(notesIn({ from: 1, to: null }, trail)).toEqual(['b', 'c', 'd']);
  });
});

describe('pendingIn', () => {
  const note = (kind: TaskNoteKind) => ({ kind });

  it('finds the one a person has not answered yet', () => {
    expect(
      pendingIn(
        ['passed', 'asked', 'message'].map((kind) =>
          note(kind as TaskNoteKind),
        ),
      ),
    ).toEqual({
      from: 1,
      to: null,
    });
  });

  it('finds nothing pending where the person already answered', () => {
    expect(
      pendingIn(
        ['asked', 'answered'].map((kind) => note(kind as TaskNoteKind)),
      ),
    ).toBeNull();
  });

  it('finds nothing pending where the task has moved on since', () => {
    expect(
      pendingIn(['asked', 'passed'].map((kind) => note(kind as TaskNoteKind))),
    ).toBeNull();
  });

  it('finds nothing pending where nobody was ever asked', () => {
    expect(pendingIn([note('passed')])).toBeNull();
  });
});

describe('reviewsIn', () => {
  const note = (kind: TaskNoteKind, runId: string | null = null) => ({
    kind,
    runId,
  });

  it('keeps the answer pending where nobody has given one', () => {
    expect([...reviewsIn([note('asked', 'run_1')])]).toEqual([
      ['run_1', { from: 0, state: 'pending' }],
    ]);
  });

  it('points a later ask at the conversation it joined', () => {
    expect([
      ...reviewsIn([
        note('asked', 'run_1'),
        note('answered'),
        note('asked', 'run_2'),
      ]),
    ]).toEqual([
      ['run_1', { from: 0, state: 'answered' }],
      ['run_2', { from: 0, state: 'pending' }],
    ]);
  });

  it('opens a new one where the task moved on in between', () => {
    expect([
      ...reviewsIn([
        note('asked', 'run_1'),
        note('passed'),
        note('asked', 'run_2'),
      ]),
    ]).toEqual([
      ['run_1', { from: 0, state: 'answered' }],
      ['run_2', { from: 2, state: 'pending' }],
    ]);
  });

  it('counts as answered once a person answers, before the task moves on', () => {
    expect([...reviewsIn([note('asked', 'run_1'), note('answered')])]).toEqual([
      ['run_1', { from: 0, state: 'answered' }],
    ]);
  });

  it('counts an asking as answered once the task moves on from it without an answer', () => {
    expect([
      ...reviewsIn([note('asked', 'run_1'), note('passed', 'run_2')]),
    ]).toEqual([['run_1', { from: 0, state: 'answered' }]]);
  });

  it('keeps each run apart', () => {
    const reviews = reviewsIn([
      note('asked', 'run_1'),
      note('answered'),
      note('passed', 'run_2'),
      note('asked', 'run_3'),
    ]);

    expect(reviews.get('run_1')?.state).toBe('answered');
    expect(reviews.get('run_3')).toEqual({ from: 3, state: 'pending' });
  });

  it('finds nothing where no run asked', () => {
    expect([...reviewsIn([note('passed', 'run_1')])]).toEqual([]);
  });
});

describe('awaitsAPerson', () => {
  const note = (kind: TaskNoteKind) => ({ kind });

  it('waits once something was put to a person', () => {
    expect(awaitsAPerson([note('asked')])).toBe(true);
  });

  it('stops waiting once they answer', () => {
    expect(awaitsAPerson([note('asked'), note('answered')])).toBe(false);
  });

  it('stops waiting once the task moved on', () => {
    expect(awaitsAPerson([note('asked'), note('passed')])).toBe(false);
  });

  it('waits again where a later run asked something new', () => {
    expect(
      awaitsAPerson([
        note('asked'),
        note('answered'),
        note('passed'),
        note('asked'),
      ]),
    ).toBe(true);
  });

  it('does not wait where nothing was asked', () => {
    expect(awaitsAPerson([note('passed')])).toBe(false);
  });
});

describe('threadAt', () => {
  const trail = [
    { runId: 'run_1', station: 'Triage', body: 'triage note' },
    { runId: null, station: 'Implementation', body: 'typed at implementation' },
    { runId: 'run_2', station: 'Implementation', body: 'it failed' },
    { runId: null, station: 'Implementation', body: 'try again' },
    { runId: 'run_3', station: 'Implementation', body: 'it failed again' },
    { runId: null, station: 'Implementation', body: 'try again once more' },
    { runId: 'run_4', station: 'Code review', body: 'code review note' },
  ];

  const bodies = (station: string | null, runId: string) =>
    threadAt(trail, station, runId).map((each) => each.body);

  it('takes every note at the station of the run', () => {
    expect(bodies('Implementation', 'run_2')).toEqual([
      'typed at implementation',
      'it failed',
      'try again',
      'it failed again',
      'try again once more',
    ]);
  });

  it('shows the same thread from each run at the station', () => {
    expect(bodies('Implementation', 'run_3')).toEqual(
      bodies('Implementation', 'run_2'),
    );
  });

  it('leaves out the notes of the other stations', () => {
    expect(bodies('Implementation', 'run_2')).not.toContain('triage note');
    expect(bodies('Implementation', 'run_2')).not.toContain('code review note');
  });

  it('takes only the notes of the run when it has no station', () => {
    expect(bodies(null, 'run_3')).toEqual(['it failed again']);
  });

  it('finds nothing in an empty trail', () => {
    expect(threadAt([], 'Triage', 'run_1')).toEqual([]);
  });
});
