import { InvalidNotePositionError } from '@work/domain/exceptions/invalid-note-position.error';

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
