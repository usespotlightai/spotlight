import { InvalidNotePositionError } from '@work/domain/exceptions/invalid-note-position.error';

export class NotePosition {
  private constructor(readonly value: number) {}

  static of(value: number): NotePosition {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidNotePositionError(value);
    }

    return new NotePosition(value);
  }

  static lastIn(trail: readonly unknown[]): NotePosition | null {
    return trail.length === 0 ? null : new NotePosition(trail.length - 1);
  }

  static nextIn(trail: readonly unknown[]): NotePosition {
    return new NotePosition(trail.length);
  }

  next(): NotePosition {
    return new NotePosition(this.value + 1);
  }

  noteIn<T>(trail: readonly T[]): T | undefined {
    return trail[this.value];
  }

  throughIn<T>(trail: readonly T[], last: NotePosition | null): T[] {
    return trail.slice(this.value, last?.next().value);
  }

  isAtOrBefore(other: NotePosition): boolean {
    return this.value <= other.value;
  }

  equals(other: NotePosition): boolean {
    return this.value === other.value;
  }
}
