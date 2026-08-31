import { InvalidTaskNoteError } from '@domain/exceptions/invalid-task-note.error';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const said = (over: Record<string, unknown> = {}) =>
  TaskNote.of({
    station: StationName.of('Triage'),
    body: TaskNoteBody.of('Reproduced on restart.'),
    at: new Date('2026-08-31T10:00:00.000Z'),
    kind: 'passed',
    ...over,
  });

describe('TaskNote', () => {
  it('is said by the run that wrote it', () => {
    expect(said({ run: RunId.of('run_1') }).author).toBeNull();
  });

  it('is said by the person who wrote it', () => {
    expect(said({ author: UserId.of('user_1') }).run).toBeNull();
  });

  // Moved by hand from the board is neither, which is nobody speaking.
  it('is said by nobody where the board itself moved the task', () => {
    const note = said();

    expect(note.author).toBeNull();
    expect(note.run).toBeNull();
  });

  it('refuses to be said by a person and a run at once', () => {
    expect(() =>
      said({ author: UserId.of('user_1'), run: RunId.of('run_1') }),
    ).toThrow(InvalidTaskNoteError);
  });
});
