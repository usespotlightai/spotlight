import { describe, expect, it } from 'vitest';
import {
  followedOnAfter,
  lastNoteOf,
  type RunNotes,
  withMessagesInFlight,
} from '@/lib/run-notes';

describe('lastNoteOf', () => {
  it('finds the last note of a run, so its thread opens there', () => {
    const notes = [
      { position: 0, runId: 'run_1' },
      { position: 1, runId: null },
      { position: 2, runId: 'run_2' },
      { position: 3, runId: 'run_2' },
    ];

    expect(lastNoteOf(notes, 'run_2')).toBe(3);
    expect(lastNoteOf(notes, 'run_9')).toBeNull();
  });
});

describe('withMessagesInFlight', () => {
  const thread = {
    runId: 'run_1',
    station: { name: 'Implementation', color: '#5c66d9', position: 2 },
    progress: null,
    notes: [{ position: 4, runId: 'run_1', body: 'The tests failed.' }],
  } as unknown as RunNotes;

  const sam = { id: 'user_1', name: 'Sam', image: null };

  const outgoing = (over: Record<string, unknown> = {}) => ({
    teamId: 'team_1',
    runId: 'run_1',
    body: 'try again',
    attachments: [],
    sentAt: Date.parse('2026-10-20T10:00:00.000Z'),
    ...over,
  });

  it('keeps the thread as it is without a message on its way', () => {
    expect(withMessagesInFlight(thread, [], sam)).toBe(thread);
  });

  it('adds the messages on their way after the last note, from the person', () => {
    expect(
      withMessagesInFlight(thread, [outgoing()], sam).notes.at(-1),
    ).toMatchObject({
      position: 5,
      kind: 'message',
      voice: 'person',
      station: 'Implementation',
      body: 'try again',
      at: '2026-10-20T10:00:00.000Z',
      author: sam,
    });
  });

  it('leaves out a message once the thread has it from the server', () => {
    const arrived = {
      ...thread,
      notes: [
        ...thread.notes,
        {
          position: 5,
          voice: 'person',
          body: 'try again',
          author: sam,
          at: '2026-10-20T10:00:01.000Z',
        },
      ],
    } as unknown as RunNotes;

    expect(withMessagesInFlight(arrived, [outgoing()], sam)).toBe(arrived);
  });

  it('matches each message from the server to one message on its way', () => {
    const once = {
      ...thread,
      notes: [
        ...thread.notes,
        {
          position: 5,
          voice: 'person',
          body: 'ok',
          author: sam,
          at: '2026-10-20T10:00:01.000Z',
        },
      ],
    } as unknown as RunNotes;

    expect(
      withMessagesInFlight(
        once,
        [outgoing({ body: 'ok ' }), outgoing({ body: 'ok' })],
        sam,
      ).notes.map((each) => each.body),
    ).toEqual(['The tests failed.', 'ok', 'ok']);
  });

  it('keeps a message that only repeats an older one', () => {
    const older = {
      ...thread,
      notes: [
        ...thread.notes,
        {
          position: 5,
          voice: 'person',
          body: 'try again',
          author: sam,
          at: '2026-10-20T08:00:00.000Z',
        },
      ],
    } as unknown as RunNotes;

    expect(withMessagesInFlight(older, [outgoing()], sam).notes).toHaveLength(
      3,
    );
  });

  it('adds an answer as an answer', () => {
    expect(
      withMessagesInFlight(thread, [outgoing({ answers: true })], sam).notes.at(
        -1,
      )?.kind,
    ).toBe('answered');
  });

  it('is queued once a message on its way starts the station again', () => {
    expect(
      withMessagesInFlight(thread, [outgoing({ startsWork: true })], sam)
        .progress,
    ).toBe('queued');
  });
});

describe('followedOnAfter', () => {
  const notes = [
    { position: 0, runId: 'run_1' },
    { position: 1, runId: null },
    { position: 2, runId: 'run_2' },
  ];

  it('opens at the last note of a run that later notes follow', () => {
    expect(followedOnAfter(notes, 'run_1')).toBe(0);
  });

  it('opens nowhere for the run with the last note', () => {
    expect(followedOnAfter(notes, 'run_2')).toBeNull();
  });

  it('opens nowhere for a run without notes', () => {
    expect(followedOnAfter(notes, 'run_3')).toBeNull();
  });
});
