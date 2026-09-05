import { InvalidTaskTitleError } from '@domain/exceptions/invalid-task-title.error';

const MAX_LENGTH = 200;

export class TaskTitle {
  private constructor(readonly value: string) {}

  static of(raw: string): TaskTitle {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidTaskTitleError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidTaskTitleError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new TaskTitle(trimmed);
  }

  /** A title from outside, cut to fit rather than refused: it is display text. */
  static clamp(raw: string): TaskTitle {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidTaskTitleError('must not be empty');
    }

    return new TaskTitle(trimmed.slice(0, MAX_LENGTH).trimEnd());
  }

  equals(other: TaskTitle): boolean {
    return this.value === other.value;
  }
}
