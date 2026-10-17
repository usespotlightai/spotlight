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
import {
  type MemoryWay,
  RunMemories,
} from '@outcomes/domain/value-objects/run-memories.vo';
import type { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import type { RunTurnout } from '@outcomes/domain/value-objects/run-turnout';
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
    readonly supersededAt: Date | null,
    readonly checks: CheckVerdict | null,
    readonly checkedAt: Date | null,
    readonly next: NextAct | null,
    readonly approvalAnsweredAt: Date | null,
    readonly cost: RunCost | null,
    readonly handedOn: HandedOn | null,
    readonly tools: RunTools | null,
    readonly refusals: readonly Refusal[],
    readonly memories: RunMemories,
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
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      [],
      RunMemories.NONE,
      0,
    );
  }

  static rehydrate(input: {
    runId: RunId;
    workspaceId: WorkspaceId;
    taskId: TaskId | null;
    end: RunEnd | null;
    supersededAt: Date | null;
    checks: CheckVerdict | null;
    checkedAt: Date | null;
    next: NextAct | null;
    approvalAnsweredAt: Date | null;
    cost: RunCost | null;
    handedOn: HandedOn | null;
    tools: RunTools | null;
    refusals: readonly Refusal[];
    memories: RunMemories;
    version: number;
  }): RunRecord {
    if (
      input.end &&
      (!input.taskId || !input.end.place.taskId.equals(input.taskId))
    ) {
      throw new InvalidOutcomeError('must end on its own task');
    }
    if ((input.checks === null) !== (input.checkedAt === null)) {
      throw new InvalidOutcomeError('must say when its change was checked');
    }
    if (input.next?.answersApproval) {
      throw new InvalidOutcomeError(
        'cannot be decided by answering an approval',
      );
    }
    if (input.tools !== null && input.cost === null) {
      throw new InvalidOutcomeError('must have its tools once digested');
    }

    return new RunRecord(
      input.runId,
      input.workspaceId,
      input.taskId,
      input.end,
      input.supersededAt,
      input.checks,
      input.checkedAt,
      input.next,
      input.approvalAnsweredAt,
      input.cost,
      input.handedOn,
      input.tools,
      input.refusals,
      input.memories,
      input.version,
    );
  }

  get superseded(): boolean {
    return this.supersededAt !== null;
  }

  asOf(at: Date): RunRecord {
    const known = (when: Date | null | undefined): boolean =>
      when !== null && when !== undefined && when.getTime() <= at.getTime();
    const checked = known(this.checkedAt);

    return new RunRecord(
      this.runId,
      this.workspaceId,
      this.taskId,
      this.end && known(this.end.endedAt) ? this.end : null,
      known(this.supersededAt) ? this.supersededAt : null,
      checked ? this.checks : null,
      checked ? this.checkedAt : null,
      known(this.next?.at) ? this.next : null,
      known(this.approvalAnsweredAt) ? this.approvalAnsweredAt : null,
      this.cost,
      known(this.handedOn?.at) ? this.handedOn : null,
      this.tools,
      this.refusals,
      this.memories,
      this.version,
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

  get turnout(): RunTurnout {
    if (this.next?.accepts) {
      return 'accepted';
    }
    if (this.next?.sendsBack) {
      return 'sent-back';
    }
    if (this.ending === 'failed') {
      return 'failed';
    }
    if (
      this.next?.act === 'answered' ||
      this.end?.asked ||
      this.approvalAnsweredAt !== null
    ) {
      return 'asked';
    }

    return 'other';
  }

  recordEnd(end: RunEnd): RunRecord {
    if (this.end) {
      return this;
    }

    this.refuseAnotherTask(end.place.taskId);

    const ended = this.with({ end, taskId: end.place.taskId });
    ended.record(new RunRecordEnded(this.runId, this.workspaceId, end.place));
    return ended;
  }

  supersededByItsTask(at: Date): RunRecord {
    return this.superseded ? this : this.with({ supersededAt: at });
  }

  recordCheck(verdict: CheckVerdict, at: Date): RunRecord {
    if (
      this.checks === null ||
      (this.checks === 'skipped' && verdict !== 'skipped')
    ) {
      return this.settledWith({ checks: verdict, checkedAt: at });
    }

    return this;
  }

  recordAction(act: NextAct): RunRecord {
    if (act.answersApproval) {
      return this.approvalAnsweredAt &&
        this.approvalAnsweredAt.getTime() <= act.at.getTime()
        ? this
        : this.settledWith({ approvalAnsweredAt: act.at });
    }

    return this.next && !act.before(this.next)
      ? this
      : this.settledWith({ next: act });
  }

  recordDigest(cost: RunCost, tools: RunTools): RunRecord {
    return this.cost ? this : this.settledWith({ cost, tools });
  }

  refused(refusal: Refusal): RunRecord {
    return this.refusals.some((each) => each.sameAs(refusal))
      ? this
      : this.with({ refusals: [...this.refusals, refusal] });
  }

  recordMemories(way: MemoryWay, memories: readonly string[]): RunRecord {
    const used = this.memories.with(way, memories);

    return used === this.memories ? this : this.with({ memories: used });
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
      throw new InvalidOutcomeError('must end on its own task');
    }
  }

  private settledWith(change: {
    checks?: CheckVerdict;
    checkedAt?: Date;
    next?: NextAct;
    approvalAnsweredAt?: Date;
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
    supersededAt?: Date;
    checks?: CheckVerdict;
    checkedAt?: Date;
    next?: NextAct;
    approvalAnsweredAt?: Date;
    cost?: RunCost;
    handedOn?: HandedOn;
    tools?: RunTools;
    refusals?: readonly Refusal[];
    memories?: RunMemories;
  }): RunRecord {
    const next = new RunRecord(
      this.runId,
      this.workspaceId,
      change.taskId ?? this.taskId,
      change.end ?? this.end,
      change.supersededAt ?? this.supersededAt,
      change.checks ?? this.checks,
      change.checkedAt ?? this.checkedAt,
      change.next ?? this.next,
      change.approvalAnsweredAt ?? this.approvalAnsweredAt,
      change.cost ?? this.cost,
      change.handedOn ?? this.handedOn,
      change.tools ?? this.tools,
      change.refusals ?? this.refusals,
      change.memories ?? this.memories,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
