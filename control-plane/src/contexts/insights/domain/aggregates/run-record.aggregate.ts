import { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import { RunRecordEnriched } from '@insights/domain/events/run-record-enriched.event';
import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import type { CheckVerdict } from '@insights/domain/value-objects/check-verdict';
import type { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import type { Refusal } from '@insights/domain/value-objects/refusal.vo';
import type { RunDisposition } from '@insights/domain/value-objects/run-disposition';
import type { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import {
  type MemoryVia,
  RunMemories,
} from '@insights/domain/value-objects/run-memories.vo';
import type { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import type { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import type { StationPass } from '@insights/domain/value-objects/station-pass.vo';
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
    readonly firstHumanAction: HumanAction | null,
    readonly approvalAnsweredAt: Date | null,
    readonly usage: RunUsage | null,
    readonly passed: StationPass | null,
    readonly tools: RunTools | null,
    readonly refusals: readonly Refusal[],
    readonly memories: RunMemories,
    readonly version: number,
  ) {
    super();
  }

  static empty(
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
    firstHumanAction: HumanAction | null;
    approvalAnsweredAt: Date | null;
    usage: RunUsage | null;
    passed: StationPass | null;
    tools: RunTools | null;
    refusals: readonly Refusal[];
    memories: RunMemories;
    version: number;
  }): RunRecord {
    if (
      input.end &&
      (!input.taskId || !input.end.location.taskId.equals(input.taskId))
    ) {
      throw new InvalidOutcomeError('must end on its own task');
    }
    if ((input.checks === null) !== (input.checkedAt === null)) {
      throw new InvalidOutcomeError('must say when its change was checked');
    }
    if (input.firstHumanAction?.answersApproval) {
      throw new InvalidOutcomeError(
        'cannot be decided by answering an approval',
      );
    }
    if (input.tools !== null && input.usage === null) {
      throw new InvalidOutcomeError(
        'must have its tools once its usage is recorded',
      );
    }

    return new RunRecord(
      input.runId,
      input.workspaceId,
      input.taskId,
      input.end,
      input.supersededAt,
      input.checks,
      input.checkedAt,
      input.firstHumanAction,
      input.approvalAnsweredAt,
      input.usage,
      input.passed,
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
      known(this.firstHumanAction?.at) ? this.firstHumanAction : null,
      known(this.approvalAnsweredAt) ? this.approvalAnsweredAt : null,
      this.usage,
      known(this.passed?.at) ? this.passed : null,
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

    return this.superseded && this.end.ending !== 'cancelled'
      ? 'superseded'
      : this.end.ending;
  }

  get disposition(): RunDisposition {
    if (this.firstHumanAction?.accepts) {
      return 'accepted';
    }
    if (this.firstHumanAction?.sendsBack) {
      return 'sent-back';
    }
    if (this.ending === 'failed') {
      return 'failed';
    }
    if (
      this.firstHumanAction?.kind === 'answered' ||
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

    this.assertSameTask(end.location.taskId);

    const ended = this.with({ end, taskId: end.location.taskId });
    ended.record(
      new RunRecordEnded(this.runId, this.workspaceId, end.location),
    );
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
      return this.enrichWith({ checks: verdict, checkedAt: at });
    }

    return this;
  }

  recordAction(action: HumanAction): RunRecord {
    if (action.answersApproval) {
      return this.approvalAnsweredAt &&
        this.approvalAnsweredAt.getTime() <= action.at.getTime()
        ? this
        : this.enrichWith({ approvalAnsweredAt: action.at });
    }

    return this.firstHumanAction && !action.before(this.firstHumanAction)
      ? this
      : this.enrichWith({ firstHumanAction: action });
  }

  recordUsage(usage: RunUsage, tools: RunTools): RunRecord {
    return this.usage ? this : this.enrichWith({ usage, tools });
  }

  refused(refusal: Refusal): RunRecord {
    return this.refusals.some((each) => each.sameAs(refusal))
      ? this
      : this.with({ refusals: [...this.refusals, refusal] });
  }

  recordMemories(via: MemoryVia, memories: readonly string[]): RunRecord {
    const used = this.memories.with(via, memories);

    return used === this.memories ? this : this.with({ memories: used });
  }

  failedAfterCallingTo(server: string): boolean {
    return (
      this.ending === 'failed' &&
      this.tools?.callsTo(server)?.lastCallFailed === true
    );
  }

  passTo(pass: StationPass): RunRecord {
    return this.passed ? this : this.with({ passed: pass });
  }

  private assertSameTask(taskId: TaskId): void {
    if (this.taskId && !this.taskId.equals(taskId)) {
      throw new InvalidOutcomeError('must end on its own task');
    }
  }

  private enrichWith(change: {
    checks?: CheckVerdict;
    checkedAt?: Date;
    firstHumanAction?: HumanAction;
    approvalAnsweredAt?: Date;
    usage?: RunUsage;
    tools?: RunTools;
  }): RunRecord {
    const enriched = this.with(change);

    if (this.end) {
      enriched.record(
        new RunRecordEnriched(this.runId, this.workspaceId, this.end.location),
      );
    }

    return enriched;
  }

  private with(change: {
    taskId?: TaskId;
    end?: RunEnd;
    supersededAt?: Date;
    checks?: CheckVerdict;
    checkedAt?: Date;
    firstHumanAction?: HumanAction;
    approvalAnsweredAt?: Date;
    usage?: RunUsage;
    passed?: StationPass;
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
      change.firstHumanAction ?? this.firstHumanAction,
      change.approvalAnsweredAt ?? this.approvalAnsweredAt,
      change.usage ?? this.usage,
      change.passed ?? this.passed,
      change.tools ?? this.tools,
      change.refusals ?? this.refusals,
      change.memories ?? this.memories,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
