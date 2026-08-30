import { InvalidTaskDescriptionError } from '@domain/exceptions/invalid-task-description.error';

const MAX_LENGTH = 20_000;

export class TaskDescription {
  private constructor(readonly value: string) {}

  static of(raw: string): TaskDescription {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidTaskDescriptionError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidTaskDescriptionError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new TaskDescription(trimmed);
  }

  equals(other: TaskDescription): boolean {
    return this.value === other.value;
  }
}
