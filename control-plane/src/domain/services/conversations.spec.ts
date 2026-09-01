import {
  awaitsAPerson,
  conversationsOf,
  notesIn,
  owedIn,
  reviewsIn,
  stillOpen,
  turnOf,
} from '@domain/services/conversations';
import type { TaskNoteKind } from '@domain/value-objects/task-note.vo';
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

  // Asked, answered, asked again: still one thing owed, not two.
  it('takes a follow-up as the same conversation carrying on', () => {
    expect(trail('asked', 'answered', 'asked')).toEqual([
      { from: 0, to: null },
    ]);
  });

  // What was settled stays settled; needing someone again is a new thing.
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
  it('holds while nothing has closed it', () => {
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

describe('owedIn', () => {
  const said = (kind: TaskNoteKind) => ({ kind });

  it('finds the one a person has not answered yet', () => {
    expect(
      owedIn(
        ['passed', 'asked', 'said'].map((kind) => said(kind as TaskNoteKind)),
      ),
    ).toEqual({
      from: 1,
      to: null,
    });
  });

  it('owes nothing where the person already answered', () => {
    expect(
      owedIn(['asked', 'answered'].map((kind) => said(kind as TaskNoteKind))),
    ).toBeNull();
  });

  it('owes nothing where the task has moved on since', () => {
    expect(
      owedIn(['asked', 'passed'].map((kind) => said(kind as TaskNoteKind))),
    ).toBeNull();
  });

  it('owes nothing where nobody was ever asked', () => {
    expect(owedIn([said('passed')])).toBeNull();
  });
});

describe('reviewsIn', () => {
  const said = (kind: TaskNoteKind, runId: string | null = null) => ({
    kind,
    runId,
  });

  it('owes an answer where nobody has given one', () => {
    expect([...reviewsIn([said('asked', 'run_1')])]).toEqual([
      ['run_1', { from: 0, state: 'owed' }],
    ]);
  });

  it('points a later ask at the conversation it joined', () => {
    expect([
      ...reviewsIn([
        said('asked', 'run_1'),
        said('answered'),
        said('asked', 'run_2'),
      ]),
    ]).toEqual([
      ['run_1', { from: 0, state: 'settled' }],
      ['run_2', { from: 0, state: 'owed' }],
    ]);
  });

  it('opens a new one where the task moved on in between', () => {
    expect([
      ...reviewsIn([
        said('asked', 'run_1'),
        said('passed'),
        said('asked', 'run_2'),
      ]),
    ]).toEqual([
      ['run_1', { from: 0, state: 'settled' }],
      ['run_2', { from: 2, state: 'owed' }],
    ]);
  });

  // The whole point of the inbox: once a person answers, nothing is owed.
  it('settles as soon as a person answers, before the task moves on', () => {
    expect([...reviewsIn([said('asked', 'run_1'), said('answered')])]).toEqual([
      ['run_1', { from: 0, state: 'settled' }],
    ]);
  });

  it('settles an asking the task moved on from unanswered', () => {
    expect([
      ...reviewsIn([said('asked', 'run_1'), said('passed', 'run_2')]),
    ]).toEqual([['run_1', { from: 0, state: 'settled' }]]);
  });

  it('keeps each run apart', () => {
    const reviews = reviewsIn([
      said('asked', 'run_1'),
      said('answered'),
      said('passed', 'run_2'),
      said('asked', 'run_3'),
    ]);

    expect(reviews.get('run_1')?.state).toBe('settled');
    expect(reviews.get('run_3')).toEqual({ from: 3, state: 'owed' });
  });

  it('finds nothing where no run asked', () => {
    expect([...reviewsIn([said('passed', 'run_1')])]).toEqual([]);
  });
});

describe('awaitsAPerson', () => {
  const said = (kind: TaskNoteKind) => ({ kind });

  it('waits once something was put to a person', () => {
    expect(awaitsAPerson([said('asked')])).toBe(true);
  });

  it('stops waiting once they answer', () => {
    expect(awaitsAPerson([said('asked'), said('answered')])).toBe(false);
  });

  // Moving a task by hand closes what was asked where it stood.
  it('stops waiting once the task moved on', () => {
    expect(awaitsAPerson([said('asked'), said('passed')])).toBe(false);
  });

  it('waits again where a later run asked something new', () => {
    expect(
      awaitsAPerson([
        said('asked'),
        said('answered'),
        said('passed'),
        said('asked'),
      ]),
    ).toBe(true);
  });

  it('does not wait where nothing was asked', () => {
    expect(awaitsAPerson([said('passed')])).toBe(false);
  });
});

describe('turnOf', () => {
  const trail = [
    { runId: 'run_1', body: 'triage said' },
    { runId: null, body: 'a person answered' },
    { runId: 'run_2', body: 'spec said' },
    { runId: null, body: 'typed at implementation' },
    { runId: 'run_3', body: 'implementation said' },
    { runId: 'run_4', body: 'code review said' },
  ];

  it('takes what the run said and what was typed at it', () => {
    expect(turnOf(trail, 'run_3').map((each) => each.body)).toEqual([
      'typed at implementation',
      'implementation said',
    ]);
  });

  // What it was answering is its briefing, not the note before it.
  it('leaves out what the run before it said', () => {
    expect(turnOf(trail, 'run_3').map((each) => each.body)).not.toContain(
      'spec said',
    );
  });

  it('leaves out what the runs after it said', () => {
    expect(turnOf(trail, 'run_3').map((each) => each.body)).not.toContain(
      'code review said',
    );
  });

  it('opens the trail for the first run', () => {
    expect(turnOf(trail, 'run_1').map((each) => each.body)).toEqual([
      'triage said',
    ]);
  });

  // A run that has not spoken still shows what has been typed at it.
  it('takes what follows the last run where it has said nothing', () => {
    expect(turnOf(trail.slice(0, 4), 'run_3').map((each) => each.body)).toEqual(
      ['typed at implementation'],
    );
  });

  it('finds nothing in an empty trail', () => {
    expect(turnOf([], 'run_1')).toEqual([]);
  });
});
