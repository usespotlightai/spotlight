import { InvalidSearchCauseError } from '@replays/domain/exceptions/invalid-search-cause.error';
import type { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const SEARCH_CAUSES = [
  'config',
  'task',
  'judge',
  'check',
  'infra',
] as const;

export type SearchCauseKind = (typeof SEARCH_CAUSES)[number];

export const MAX_CAUSE_TEXT = 4_000;

const isCause = (raw: unknown): raw is SearchCauseKind =>
  (SEARCH_CAUSES as readonly unknown[]).includes(raw);

const textOf = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim() : '';

export class SearchCause {
  private constructor(
    readonly taskId: TaskId,
    readonly originalRunId: RunId,
    readonly replayRunId: RunId,
    readonly cause: SearchCauseKind,
    readonly evidence: string,
    readonly suggestion: string | null,
    readonly recordedAt: Date,
  ) {}

  static of(input: {
    task: ReflectedTask;
    cause: unknown;
    evidence: unknown;
    suggestion: unknown;
    at: Date;
  }): SearchCause {
    if (!isCause(input.cause)) {
      throw new InvalidSearchCauseError(
        'cause',
        `is one of ${SEARCH_CAUSES.join(', ')}`,
      );
    }

    const evidence = textOf(input.evidence);
    const suggestion = textOf(input.suggestion);

    if (evidence.length === 0 || evidence.length > MAX_CAUSE_TEXT) {
      throw new InvalidSearchCauseError(
        'evidence',
        `says what in the runs shows the cause, in 1 to ${MAX_CAUSE_TEXT.toLocaleString('en-US')} characters`,
      );
    }
    if (suggestion.length > MAX_CAUSE_TEXT) {
      throw new InvalidSearchCauseError(
        'suggestion',
        `says what to fix in at most ${MAX_CAUSE_TEXT.toLocaleString('en-US')} characters`,
      );
    }

    return new SearchCause(
      input.task.taskId,
      input.task.originalRunId,
      input.task.replayRunId,
      input.cause,
      evidence,
      suggestion || null,
      input.at,
    );
  }

  static rehydrate(input: {
    taskId: TaskId;
    originalRunId: RunId;
    replayRunId: RunId;
    cause: SearchCauseKind;
    evidence: string;
    suggestion: string | null;
    recordedAt: Date;
  }): SearchCause {
    return new SearchCause(
      input.taskId,
      input.originalRunId,
      input.replayRunId,
      input.cause,
      input.evidence,
      input.suggestion,
      input.recordedAt,
    );
  }

  get configCanFix(): boolean {
    return this.cause === 'config';
  }

  isAbout(taskId: TaskId): boolean {
    return this.taskId.equals(taskId);
  }
}
