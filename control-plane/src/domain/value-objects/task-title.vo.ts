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

  equals(other: TaskTitle): boolean {
    return this.value === other.value;
  }
}
