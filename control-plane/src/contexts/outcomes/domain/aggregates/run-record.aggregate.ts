import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import type { CheckVerdict } from '@outcomes/domain/value-objects/check-verdict';
import type { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import type { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunRecord {
  private constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId | null,
    readonly end: RunEnd | null,
    readonly superseded: boolean,
    readonly checks: CheckVerdict | null,
    readonly next: NextAct | null,
    readonly version: number,
  ) {}

  static heardOf(
    runId: RunId,
    workspaceId: WorkspaceId,
    taskId: TaskId | null = null,
  ): RunRecord {
    return new RunRecord(
      runId,
      workspaceId,
      taskId,
      null,
      false,
      null,
      null,
      0,
    );
  }

  static rehydrate(input: {
    runId: RunId;
    workspaceId: WorkspaceId;
    taskId: TaskId | null;
    end: RunEnd | null;
    superseded: boolean;
    checks: CheckVerdict | null;
    next: NextAct | null;
    version: number;
  }): RunRecord {
    if (
      input.end &&
      (!input.taskId || !input.end.place.taskId.equals(input.taskId))
    ) {
      throw new InvalidOutcomeError('ends on the task it was heard of for');
    }

    return new RunRecord(
      input.runId,
      input.workspaceId,
      input.taskId,
      input.end,
      input.superseded,
      input.checks,
      input.next,
      input.version,
    );
  }

  get hasEnded(): boolean {
    return this.end !== null;
  }

  get ran(): boolean {
    return this.end?.ran === true;
  }

  get ending(): RunEnding | null {
    if (!this.end) {
      return null;
    }

    return this.superseded ? 'superseded' : this.end.ending;
  }

  ended(end: RunEnd): RunRecord {
    if (this.end) {
      return this;
    }

    if (this.taskId && !this.taskId.equals(end.place.taskId)) {
      throw new InvalidOutcomeError('ends on the task it was heard of for');
    }

    return this.with({ end, taskId: end.place.taskId });
  }

  supersededByItsTask(): RunRecord {
    return this.superseded ? this : this.with({ superseded: true });
  }

  checked(verdict: CheckVerdict): RunRecord {
    if (
      this.checks === null ||
      (this.checks === 'skipped' && verdict !== 'skipped')
    ) {
      return this.with({ checks: verdict });
    }

    return this;
  }

  actedOn(act: NextAct): RunRecord {
    return this.next ? this : this.with({ next: act });
  }

  private with(change: {
    taskId?: TaskId;
    end?: RunEnd;
    superseded?: boolean;
    checks?: CheckVerdict;
    next?: NextAct;
  }): RunRecord {
    return new RunRecord(
      this.runId,
      this.workspaceId,
      change.taskId ?? this.taskId,
      change.end ?? this.end,
      change.superseded ?? this.superseded,
      change.checks ?? this.checks,
      change.next ?? this.next,
      this.version,
    );
  }
}
