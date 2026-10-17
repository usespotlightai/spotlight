import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-31T10:00:00.000Z');

const said = (over: Record<string, unknown> = {}) =>
  TaskNote.of({
    position: NotePosition.of(0),
    voice: Voice.station(),
    station: StationName.of('Triage'),
    body: TaskNoteBody.of('Reproduced on restart.'),
    at: NOW,
    kind: 'passed',
    ...over,
  });

describe('TaskNote', () => {
  it('is the same note wherever it is in the trail, however it has changed', () => {
    const note = said({ kind: 'asked' });

    expect(note.read(NOW).equals(note)).toBe(true);
    expect(note.equals(said({ position: NotePosition.of(1) }))).toBe(false);
  });

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
