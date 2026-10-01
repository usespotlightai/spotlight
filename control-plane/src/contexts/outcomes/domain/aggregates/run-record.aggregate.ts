import { RunRecordEnded } from '@outcomes/domain/events/run-record-ended.event';
import { RunRecordSettled } from '@outcomes/domain/events/run-record-settled.event';
import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import type { CheckVerdict } from '@outcomes/domain/value-objects/check-verdict';
import type { HandedOn } from '@outcomes/domain/value-objects/handed-on.vo';
import type { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import type { Refusal } from '@outcomes/domain/value-objects/refusal.vo';
import type { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import type { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';
import type { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunRecord extends EventRecorder {
  private constructor(
    readonly runId: RunId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId | null,
    readonly end: RunEnd | null,
    readonly superseded: boolean,
    readonly checks: CheckVerdict | null,
    readonly next: NextAct | null,
    readonly cost: RunCost | null,
    readonly handedOn: HandedOn | null,
    readonly tools: RunTools | null,
    readonly refusals: readonly Refusal[],
    readonly version: number,
  ) {
    super();
  }

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
      null,
      null,
      null,
      [],
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
    cost: RunCost | null;
    handedOn: HandedOn | null;
    tools: RunTools | null;
    refusals: readonly Refusal[];
    version: number;
  }): RunRecord {
    if (
      input.end &&
      (!input.taskId || !input.end.place.taskId.equals(input.taskId))
    ) {
      throw new InvalidOutcomeError('ends on the task it was heard of for');
    }
    if (input.tools !== null && input.cost === null) {
      throw new InvalidOutcomeError('holds the tools it used once digested');
    }

    return new RunRecord(
      input.runId,
      input.workspaceId,
      input.taskId,
      input.end,
      input.superseded,
      input.checks,
      input.next,
      input.cost,
      input.handedOn,
      input.tools,
      input.refusals,
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

    this.refuseAnotherTask(end.place.taskId);

    const ended = this.with({ end, taskId: end.place.taskId });
    ended.record(new RunRecordEnded(this.runId, this.workspaceId, end.place));
    return ended;
  }

  supersededByItsTask(): RunRecord {
    return this.superseded ? this : this.with({ superseded: true });
  }

  checked(verdict: CheckVerdict): RunRecord {
    if (
      this.checks === null ||
      (this.checks === 'skipped' && verdict !== 'skipped')
    ) {
      return this.settledWith({ checks: verdict });
    }

    return this;
  }

  actedOn(act: NextAct): RunRecord {
    return this.next ? this : this.settledWith({ next: act });
  }

  digested(cost: RunCost, tools: RunTools): RunRecord {
    return this.cost ? this : this.settledWith({ cost, tools });
  }

  refused(refusal: Refusal): RunRecord {
    return this.refusals.some((each) => each.sameAs(refusal))
      ? this
      : this.with({ refusals: [...this.refusals, refusal] });
  }

  failedAfterCallingTo(server: string): boolean {
    return (
      this.ending === 'failed' &&
      this.tools?.callsTo(server)?.lastCallFailed === true
    );
  }

  handedOnTo(handedOn: HandedOn): RunRecord {
    return this.handedOn ? this : this.with({ handedOn });
  }

  private refuseAnotherTask(taskId: TaskId): void {
    if (this.taskId && !this.taskId.equals(taskId)) {
      throw new InvalidOutcomeError('ends on the task it was heard of for');
    }
  }

  private settledWith(change: {
    checks?: CheckVerdict;
    next?: NextAct;
    cost?: RunCost;
    tools?: RunTools;
  }): RunRecord {
    const settled = this.with(change);

    if (this.end) {
      settled.record(
        new RunRecordSettled(this.runId, this.workspaceId, this.end.place),
      );
    }

    return settled;
  }

  private with(change: {
    taskId?: TaskId;
    end?: RunEnd;
    superseded?: boolean;
    checks?: CheckVerdict;
    next?: NextAct;
    cost?: RunCost;
    handedOn?: HandedOn;
    tools?: RunTools;
    refusals?: readonly Refusal[];
  }): RunRecord {
    const next = new RunRecord(
      this.runId,
      this.workspaceId,
      change.taskId ?? this.taskId,
      change.end ?? this.end,
      change.superseded ?? this.superseded,
      change.checks ?? this.checks,
      change.next ?? this.next,
      change.cost ?? this.cost,
      change.handedOn ?? this.handedOn,
      change.tools ?? this.tools,
      change.refusals ?? this.refusals,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
