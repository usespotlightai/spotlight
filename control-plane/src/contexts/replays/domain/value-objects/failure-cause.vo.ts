import { InvalidFailureCauseError } from '@replays/domain/exceptions/invalid-failure-cause.error';
import type { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const FAILURE_CAUSES = [
  'config',
  'task',
  'judge',
  'check',
  'infra',
] as const;

export type FailureCauseKind = (typeof FAILURE_CAUSES)[number];

export const MAX_CAUSE_TEXT = 4_000;

const isCause = (raw: unknown): raw is FailureCauseKind =>
  (FAILURE_CAUSES as readonly unknown[]).includes(raw);

const textOf = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim() : '';

export class FailureCause {
  private constructor(
    readonly taskId: TaskId,
    readonly originalRunId: RunId,
    readonly replayRunId: RunId,
    readonly cause: FailureCauseKind,
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
  }): FailureCause {
    if (!isCause(input.cause)) {
      throw new InvalidFailureCauseError(
        'cause',
        `is one of ${FAILURE_CAUSES.join(', ')}`,
      );
    }

    const evidence = textOf(input.evidence);
    const suggestion = textOf(input.suggestion);

    if (evidence.length === 0 || evidence.length > MAX_CAUSE_TEXT) {
      throw new InvalidFailureCauseError(
        'evidence',
        `says what in the runs shows the cause, in 1 to ${MAX_CAUSE_TEXT.toLocaleString('en-US')} characters`,
      );
    }
    if (suggestion.length > MAX_CAUSE_TEXT) {
      throw new InvalidFailureCauseError(
        'suggestion',
        `says what to fix in at most ${MAX_CAUSE_TEXT.toLocaleString('en-US')} characters`,
      );
    }

    return new FailureCause(
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
    cause: FailureCauseKind;
    evidence: string;
    suggestion: string | null;
    recordedAt: Date;
  }): FailureCause {
    return new FailureCause(
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
