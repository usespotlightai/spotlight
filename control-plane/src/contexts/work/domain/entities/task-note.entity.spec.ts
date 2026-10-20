import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-31T10:00:00.000Z');

const aNote = (over: Record<string, unknown> = {}) =>
  TaskNote.of({
    position: NotePosition.of(0),
    voice: Voice.station(),
    station: StationName.of('Triage'),
    stationId: StationId.of('station_triage'),
    body: TaskNoteBody.of('Reproduced on restart.'),
    at: NOW,
    kind: 'passed',
    ...over,
  });

describe('TaskNote', () => {
  it('is the same note wherever it is in the trail, however it has changed', () => {
    const note = aNote({ kind: 'asked' });

    expect(note.read(NOW).equals(note)).toBe(true);
    expect(note.equals(aNote({ position: NotePosition.of(1) }))).toBe(false);
  });

  it('carries who wrote it, whole', () => {
    const note = aNote({ voice: Voice.person(UserId.of('user_1')) });

    expect(note.voice.isPerson).toBe(true);
    expect(note.voice.author?.value).toBe('user_1');
  });

  it('waits to be acknowledged where it is a message', () => {
    expect(
      aNote({ kind: 'message', voice: Voice.world() }).unacknowledged,
    ).toBe(true);
    expect(aNote({ kind: 'passed' }).unacknowledged).toBe(false);
  });

  it('is acknowledged once, and stays so', () => {
    const handed = aNote({ kind: 'message', voice: Voice.world() }).acknowledge(
      NOW,
    );

    expect(handed.unacknowledged).toBe(false);
    expect(handed.acknowledge(new Date()).acknowledgedAt).toEqual(NOW);
  });

  it('is unread only while a person has been asked something', () => {
    expect(aNote({ kind: 'asked' }).unread).toBe(true);
    expect(aNote({ kind: 'asked' }).read(NOW).unread).toBe(false);
    expect(aNote({ kind: 'passed' }).unread).toBe(false);
  });
});
