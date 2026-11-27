import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';
import { NoteMove } from '@work/domain/value-objects/note-move.vo';
import { describe, expect, it } from 'vitest';

const BACKLOG = StationId.of('station_0');

describe('NoteMove', () => {
  it('shows a move by the line or by a person on the task, and leaves a run’s pass to its run', () => {
    expect(NoteMove.to(BACKLOG, 'line').madeOutsideARun).toBe(true);
    expect(NoteMove.to(BACKLOG, 'person').madeOutsideARun).toBe(true);
    expect(NoteMove.to(BACKLOG, 'run').madeOutsideARun).toBe(false);
  });

  it('reads back what it stored', () => {
    expect(
      NoteMove.of(BACKLOG, 'line').equals(NoteMove.to(BACKLOG, 'line')),
    ).toBe(true);
  });

  it('refuses a mover it does not know', () => {
    expect(() => NoteMove.of(BACKLOG, 'robot')).toThrow(InvalidTaskNoteError);
  });
});
