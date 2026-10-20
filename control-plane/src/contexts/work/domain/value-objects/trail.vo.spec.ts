import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import {
  TaskNote,
  type TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Trail } from '@work/domain/value-objects/trail.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-31T12:00:00.000Z');

const note = (kind: TaskNoteKind, over: Record<string, unknown> = {}) =>
  TaskNote.of({
    position: NotePosition.of(0),
    voice: Voice.station(),
    station: StationName.of('Triage'),
    stationId: StationId.of('station_triage'),
    body: TaskNoteBody.of(`a ${kind} note`),
    at: NOW,
    kind,
    ...over,
  });

const trail = (...notes: TaskNote[]) =>
  Trail.of(
    notes.map((each, at) =>
      TaskNote.of({ ...each, position: NotePosition.of(at) }),
    ),
  );

describe('Trail', () => {
  it('keeps the answer pending while nobody has given one', () => {
    expect(trail(note('passed'), note('asked')).pending).toEqual({
      from: 1,
      to: null,
    });
    expect(trail(note('asked'), note('answered')).pending).toBeNull();
  });

  it('keeps the notes of one conversation, whole', () => {
    const whole = trail(note('passed'), note('asked'), note('answered'));

    expect(whole.within({ value: 1 } as never)).toHaveLength(2);
    expect(whole.within({ value: 0 } as never)).toBeNull();
  });

  it('waits to hand a person’s word and the world’s to an agent', () => {
    const waiting = trail(
      note('message', { voice: 'person', author: UserId.of('user_1') }),
      note('message', { voice: 'world' }),
      note('passed', { run: RunId.of('run_1') }),
    );

    expect(waiting.unacknowledged.map((each) => each.voice)).toEqual([
      'person',
      'world',
    ]);
  });
});
