import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidTaskFailureError } from '@work/domain/exceptions/invalid-task-failure.error';

const RUN = 'run';
const HOOK = 'hook:';

export type TaskFailureSource = typeof RUN | `${typeof HOOK}${string}`;

const blank = (text: string): boolean => text.trim().length === 0;

const isSource = (source: string): source is TaskFailureSource =>
  source === RUN ||
  (source.startsWith(HOOK) && !blank(source.slice(HOOK.length)));

export class TaskFailure {
  private constructor(
    readonly source: TaskFailureSource,
    readonly code: string,
    readonly occurrences: number,
  ) {}

  static fromRun(code: string): TaskFailure {
    return TaskFailure.raised(RUN, code);
  }

  static fromHook(hook: string, code: string): TaskFailure {
    if (blank(hook)) {
      throw new InvalidTaskFailureError('from a hook names the hook');
    }

    return TaskFailure.raised(`${HOOK}${hook.trim()}`, code);
  }

  private static raised(source: TaskFailureSource, code: string): TaskFailure {
    if (blank(code)) {
      throw new InvalidTaskFailureError('says what went wrong');
    }

    return new TaskFailure(source, code, 1);
  }

  static rehydrate(input: {
    source: string;
    code: string;
    occurrences: number;
  }): TaskFailure {
    if (!isSource(input.source) || blank(input.code)) {
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
