import { RunId } from '@domain/value-objects/run-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import {
  TaskNote,
  type TaskNoteKind,
} from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { Trail } from '@domain/value-objects/trail.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-31T12:00:00.000Z');

const said = (kind: TaskNoteKind, over: Record<string, unknown> = {}) =>
  TaskNote.of({
    voice: Voice.station(),
    station: StationName.of('Triage'),
    body: TaskNoteBody.of(`a ${kind} note`),
    at: NOW,
    kind,
    ...over,
  });

const trail = (...notes: TaskNote[]) => Trail.of(notes);

describe('Trail', () => {
  it('owes an answer while nobody has given one', () => {
    expect(trail(said('passed'), said('asked')).owed).toEqual({
      from: 1,
      to: null,
    });
    expect(trail(said('asked'), said('answered')).owed).toBeNull();
  });

  it('holds what was said in one conversation, whole', () => {
    const held = trail(said('passed'), said('asked'), said('answered'));

    expect(held.within({ value: 1 } as never)).toHaveLength(2);
    expect(held.within({ value: 0 } as never)).toBeNull();
  });

  it('waits to hand a person’s word and the world’s to an agent', () => {
    const waiting = trail(
      said('said', { voice: 'person', author: UserId.of('user_1') }),
      said('said', { voice: 'world' }),
      said('passed', { run: RunId.of('run_1') }),
    );

    expect(waiting.undelivered.map((each) => each.voice)).toEqual([
      'person',
      'world',
    ]);
  });

  it('is added to rather than changed', () => {
    const one = trail(said('asked'));
    const two = one.with(said('answered'));

    expect(one.notes).toHaveLength(1);
    expect(two.notes.map((each) => each.kind)).toEqual(['asked', 'answered']);
  });
});
