import { InvalidTaskNoteError } from '@domain/exceptions/invalid-task-note.error';

const MAX_LENGTH = 4_000;

export class TaskNoteBody {
  private constructor(readonly value: string) {}

  static of(raw: string): TaskNoteBody {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidTaskNoteError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidTaskNoteError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new TaskNoteBody(trimmed);
  }

  equals(other: TaskNoteBody): boolean {
    return this.value === other.value;
  }
}
