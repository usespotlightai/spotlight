import { RunDismissalRecorded } from '@insights/domain/events/run-dismissal-recorded.event';
import { RunMemoriesRecorded } from '@insights/domain/events/run-memories-recorded.event';
import { RunOutcomeChanged } from '@insights/domain/events/run-outcome-changed.event';
import { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import { RunRecordErased } from '@insights/domain/events/run-record-erased.event';
import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import type { CheckVerdict } from '@insights/domain/value-objects/check-verdict';
import type { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import type {
  ActedOnTool,
  HumanAction,
} from '@insights/domain/value-objects/human-action.vo';
import type { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import {
  RunFact,
  type RunPullRequest,
  type TaskOpeningFact,
} from '@insights/domain/value-objects/run-fact.vo';
import {
  type MemoryReference,
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
    readonly dismissals: readonly Dismissal[],
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
    dismissals: readonly Dismissal[];
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
      input.dismissals,
      input.memories,
      input.version,
    );
  }

  static creditedWithActionAt(
    records: readonly RunRecord[],
    at: Date,
  ): RunRecord | null {
    return records.reduce<RunRecord | null>((credited, each) => {
      const endedAt = each.end?.endedAt;

      if (!each.ran || !endedAt || endedAt.getTime() > at.getTime()) {
        return credited;
      }

      return credited?.end && credited.end.endedAt >= endedAt ? credited : each;
    }, null);
  }

  get superseded(): boolean {
    return this.supersededAt !== null;
  }

  get hasEnded(): boolean {
    return this.end !== null;
  }

  get ran(): boolean {
    return this.end?.ran === true;
  }

  factWith(
    opening: TaskOpeningFact | null,
    pullRequest: RunPullRequest | null,
  ): RunFact | null {
    return this.end
      ? RunFact.of({
          runId: this.runId,
          workspaceId: this.workspaceId,
          end: this.end,
          supersededAt: this.supersededAt,
          checks: this.checks,
          checkedAt: this.checkedAt,
          firstHumanAction: this.firstHumanAction,
          approvalAnsweredAt: this.approvalAnsweredAt,
          usage: this.usage,
          passed: this.passed,
          tools: this.tools,
          dismissals: this.dismissals,
          memories: this.memories,
          opening,
          pullRequest,
        })
      : null;
  }

  erased(): RunRecord {
    const erased = this.with({});

    erased.record(new RunRecordErased(this.runId, this.workspaceId));

    return erased;
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
    return this.superseded ? this : this.withOutcome({ supersededAt: at });
  }

  recordCheck(verdict: CheckVerdict, at: Date): RunRecord {
    if (
      this.checks === null ||
      (this.checks === 'skipped' && verdict !== 'skipped')
    ) {
      return this.withOutcome({ checks: verdict, checkedAt: at });
    }

    return this;
  }

  recordAction(
    action: HumanAction,
    acted: ActedOnTool | null = null,
  ): RunRecord {
    const recorded = this.recordedAction(action);
    const dismissal = acted ? action.dismissalOf(acted) : null;

    return dismissal ? recorded.dismissed(dismissal) : recorded;
  }

  private recordedAction(action: HumanAction): RunRecord {
    if (action.answersApproval) {
      return this.approvalAnsweredAt &&
        this.approvalAnsweredAt.getTime() <= action.at.getTime()
        ? this
        : this.withOutcome({ approvalAnsweredAt: action.at });
    }

    return this.firstHumanAction && !action.before(this.firstHumanAction)
      ? this
      : this.withOutcome({ firstHumanAction: action });
  }

  recordUsage(usage: RunUsage, tools: RunTools): RunRecord {
    return this.usage ? this : this.withOutcome({ usage, tools });
  }

  dismissed(dismissal: Dismissal): RunRecord {
    if (this.dismissals.some((each) => each.sameAs(dismissal))) {
      return this;
    }

    const dismissed = this.with({
      dismissals: [...this.dismissals, dismissal],
    });

    if (this.end) {
      dismissed.record(new RunDismissalRecorded(this.runId, this.workspaceId));
    }

    return dismissed;
  }

  recordMemories(
    via: MemoryVia,
    memories: readonly MemoryReference[],
  ): RunRecord {
    const used = this.memories.with(via, memories);

    if (used === this.memories) {
      return this;
    }

    const remembered = this.with({ memories: used });

    if (this.end) {
      remembered.record(new RunMemoriesRecorded(this.runId, this.workspaceId));
    }

    return remembered;
  }

  passTo(pass: StationPass): RunRecord {
    return this.passed ? this : this.withOutcome({ passed: pass });
  }

  private assertSameTask(taskId: TaskId): void {
    if (this.taskId && !this.taskId.equals(taskId)) {
      throw new InvalidOutcomeError('must end on its own task');
    }
  }

  private withOutcome(change: {
    supersededAt?: Date;
    passed?: StationPass;
    checks?: CheckVerdict;
    checkedAt?: Date;
    firstHumanAction?: HumanAction;
    approvalAnsweredAt?: Date;
    usage?: RunUsage;
    tools?: RunTools;
  }): RunRecord {
    const changed = this.with(change);

    if (this.end) {
      changed.record(
        new RunOutcomeChanged(this.runId, this.workspaceId, this.end.location),
      );
    }

    return changed;
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
    dismissals?: readonly Dismissal[];
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
      change.dismissals ?? this.dismissals,
      change.memories ?? this.memories,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }
}
