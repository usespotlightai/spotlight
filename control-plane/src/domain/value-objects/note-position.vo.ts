import { InvalidNotePositionError } from '@domain/exceptions/invalid-note-position.error';

/** Where a note stands in a task's trail. Notes are appended, never reordered. */
export class NotePosition {
  private constructor(readonly value: number) {}

  static of(value: number): NotePosition {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidNotePositionError(value);
    }

    return new NotePosition(value);
  }

  isAtOrBefore(other: NotePosition): boolean {
    return this.value <= other.value;
  }

  equals(other: NotePosition): boolean {
    return this.value === other.value;
  }
}
