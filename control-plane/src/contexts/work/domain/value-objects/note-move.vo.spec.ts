import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidTaskNoteError } from '@work/domain/exceptions/invalid-task-note.error';
import {
  BY_A_RUN,
  byAPerson,
  byTheLine,
  NoteMove,
} from '@work/domain/value-objects/note-move.vo';
import { describe, expect, it } from 'vitest';

const BACKLOG = StationId.of('station_0');
const ADA = UserId.of('user_1');

describe('NoteMove', () => {
  it('shows a move by the line or by a person on the task, and leaves a run’s pass to its run', () => {
    expect(NoteMove.to(BACKLOG, byTheLine()).madeOutsideARun).toBe(true);
    expect(NoteMove.to(BACKLOG, byAPerson(ADA)).madeOutsideARun).toBe(true);
    expect(NoteMove.to(BACKLOG, BY_A_RUN).madeOutsideARun).toBe(false);
  });

  it('keeps who moved it and why, without blank reasons', () => {
    const move = NoteMove.to(BACKLOG, byAPerson(ADA, '  Rebase it.  '));

    expect(move.who).toEqual(ADA);
    expect(move.why).toBe('Rebase it.');
    expect(NoteMove.to(BACKLOG, byTheLine('  ')).why).toBeNull();
  });

  it('reads back what it stored', () => {
    expect(
      NoteMove.rehydrate({
        to: 'station_0',
        by: 'person',
        who: 'user_1',
        why: 'Rebase it.',
      }).equals(NoteMove.to(BACKLOG, byAPerson(ADA, 'Rebase it.'))),
    ).toBe(true);
  });

  it('refuses a mover it does not know, or a person on a move by the line', () => {
    expect(() => NoteMove.rehydrate({ to: 'station_0', by: 'robot' })).toThrow(
      InvalidTaskNoteError,
    );
    expect(() =>
      NoteMove.rehydrate({ to: 'station_0', by: 'line', who: 'user_1' }),
    ).toThrow(InvalidTaskNoteError);
  });
});
