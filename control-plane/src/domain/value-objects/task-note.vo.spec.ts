import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-31T10:00:00.000Z');

const said = (over: Record<string, unknown> = {}) =>
  TaskNote.of({
    voice: Voice.station(),
    station: StationName.of('Triage'),
    body: TaskNoteBody.of('Reproduced on restart.'),
    at: NOW,
    kind: 'passed',
    ...over,
  });

describe('TaskNote', () => {
  it('carries who spoke, whole', () => {
    const note = said({ voice: Voice.person(UserId.of('user_1')) });

    expect(note.voice.isPerson).toBe(true);
    expect(note.voice.author?.value).toBe('user_1');
  });

  it('waits to be delivered where somebody said something', () => {
    expect(said({ kind: 'said', voice: Voice.world() }).undelivered).toBe(true);
    expect(said({ kind: 'passed' }).undelivered).toBe(false);
  });

  it('is delivered once, and stays so', () => {
    const handed = said({ kind: 'said', voice: Voice.world() }).delivered(NOW);

    expect(handed.undelivered).toBe(false);
    expect(handed.delivered(new Date()).deliveredAt).toEqual(NOW);
  });

  it('is unread only while a person has been asked something', () => {
    expect(said({ kind: 'asked' }).unread).toBe(true);
    expect(said({ kind: 'asked' }).read(NOW).unread).toBe(false);
    expect(said({ kind: 'passed' }).unread).toBe(false);
  });
});
