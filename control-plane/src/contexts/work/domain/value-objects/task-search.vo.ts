import { InvalidTaskSearchError } from '@work/domain/exceptions/invalid-task-search.error';

const MAX_LENGTH = 200;

// The words a task's title or description holds, each in any case, for the task to match.
export class TaskSearch {
  private constructor(readonly words: readonly string[]) {}

  static of(raw: string): TaskSearch {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidTaskSearchError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidTaskSearchError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new TaskSearch([...new Set(trimmed.toLowerCase().split(/\s+/))]);
  }
}
