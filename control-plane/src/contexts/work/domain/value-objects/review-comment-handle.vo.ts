import { itemAt } from '@shared-kernel/domain/item-at';
import { InvalidNotePositionError } from '@work/domain/exceptions/invalid-note-position.error';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';

const SHAPE = /^c(\d+)$/;

export const ReviewCommentHandle = {
  for(position: NotePosition): string {
    return `c${position.value}`;
  },

  of(handle: string): NotePosition {
    const shaped = SHAPE.exec(handle.trim().toLowerCase());

    const digits = shaped === null ? undefined : itemAt(shaped, 1);

    if (digits === undefined || digits === '') {
      throw new InvalidNotePositionError(handle);
    }

    return NotePosition.of(Number(digits));
  },
};
