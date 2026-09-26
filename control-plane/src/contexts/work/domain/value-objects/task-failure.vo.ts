import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class TaskFailure {
  private constructor(
    readonly source: string,
    readonly code: string,
    readonly occurrences: number,
  ) {}

  static of(input: { source: string; code: string }): TaskFailure {
    return TaskFailure.rehydrate({ ...input, occurrences: 1 });
  }

  static rehydrate(input: {
    source: string;
    code: string;
    occurrences: number;
  }): TaskFailure {
    if (!input.source.trim() || !input.code.trim()) {
      throw new InconsistentStateError(
        'task failure',
        'says nothing of where it came from or what it was',
      );
    }

    if (!Number.isInteger(input.occurrences) || input.occurrences < 1) {
      throw new InconsistentStateError(
        'task failure',
        `happened an impossible number of times (${input.occurrences})`,
      );
    }

    return new TaskFailure(input.source, input.code, input.occurrences);
  }

  sameAs(other: TaskFailure): boolean {
    return this.source === other.source && this.code === other.code;
  }

  again(): TaskFailure {
    return new TaskFailure(this.source, this.code, this.occurrences + 1);
  }

  following(earlier: TaskFailure | null): TaskFailure {
    return earlier && this.sameAs(earlier) ? earlier.again() : this;
  }

  equals(other: TaskFailure): boolean {
    return this.sameAs(other) && this.occurrences === other.occurrences;
  }
}
