import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunStopRequested } from '@work/domain/events/run-stop-requested.event';
import { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import type { RunState } from '@work/domain/value-objects/run-state';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

const LEASE_DURATION_MS = 60_000;

const MAX_ATTEMPTS = 3;

export class Run extends EventRecorder {
  private constructor(
    readonly id: RunId,
    readonly workspaceId: WorkspaceId,
    readonly harness: HarnessId,
    readonly priority: RunPriority,
    readonly subject: RunSubject | null,
    readonly spec: RunSpec,
    readonly targetRunner: RunnerId | null,
    readonly state: RunState,
    readonly claimedBy: RunnerId | null,
    readonly leaseExpiresAt: Date | null,
    readonly outcome: RunOutcome | null,
    readonly attempt: number,
    readonly stopRequestedAt: Date | null,
    readonly version: number = 0,
  ) {
    super();
  }

  static enqueue(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority?: RunPriority;
    subject?: RunSubject | null;
    spec: RunSpec;
    targetRunner?: RunnerId | null;
  }): Run {
    return new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority ?? RunPriority.normal,
      input.subject ?? null,
      input.spec,
      input.targetRunner ?? null,
      'queued',
      null,
      null,
      null,
      1,
      null,
    );
  }

  static rehydrate(input: {
    id: RunId;
    workspaceId: WorkspaceId;
    harness: HarnessId;
    priority: RunPriority;
    subject: RunSubject | null;
    spec: RunSpec;
    targetRunner: RunnerId | null;
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    outcome: RunOutcome | null;
    attempt: number;
    stopRequestedAt?: Date | null;
    version?: number;
  }): Run {
    Run.guardReconstituted(input);

    return new Run(
      input.id,
      input.workspaceId,
      input.harness,
      input.priority,
      input.subject,
      input.spec,
      input.targetRunner,
      input.state,
      input.claimedBy,
      input.leaseExpiresAt,
      input.outcome,
      input.attempt,
      input.stopRequestedAt ?? null,
      input.version ?? 0,
    );
  }

  private static guardReconstituted(input: {
    state: RunState;
    claimedBy: RunnerId | null;
    leaseExpiresAt: Date | null;
    attempt: number;
  }): void {
    if (input.attempt < 1) {
      throw new InconsistentStateError('run', 'has no attempt to its name');
    }
    if (input.state === 'claimed' && !input.claimedBy) {
      throw new InconsistentStateError('run', 'is claimed by nobody');
    }
    if (input.state === 'claimed' && !input.leaseExpiresAt) {
      throw new InconsistentStateError('run', 'is claimed with no lease');
    }
    if (input.state === 'queued' && (input.claimedBy || input.leaseExpiresAt)) {
      throw new InconsistentStateError(
        'run',
        'is queued yet still held by a runner',
      );
    }
  }

  get taskId(): TaskId | null {
    return this.subject?.taskId ?? null;
  }

  get stationId(): StationId | null {
    return this.subject?.stationId ?? null;
  }

  get chatId(): ChatId | null {
    return this.subject?.chatId ?? null;
  }

  claim(by: RunnerId, now: Date): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `cannot be claimed while it is ${this.state}`,
      );
    }
    if (this.targetRunner && !this.targetRunner.equals(by)) {
      throw new InvalidRunTransitionError(
        'cannot be claimed by a runner it was not meant for',
      );
    }

    return this.with({
      state: 'claimed',
      claimedBy: by,
      leaseExpiresAt: this.leaseFrom(now),
    });
  }

  requeue(now: Date): Run {
    if (!this.lapsed(now)) {
      throw new InvalidRunTransitionError(
        `cannot be requeued while it is ${this.state} and its lease holds`,
      );
    }

    if (this.attempt >= MAX_ATTEMPTS) {
      return this.givenUp(`no runner finished it in ${MAX_ATTEMPTS} attempts`);
    }

    return this.backOnTheQueue();
  }

  private givenUp(reason: string): Run {
    const abandoned = this.with({
      state: 'failed',
      claimedBy: null,
      leaseExpiresAt: null,
      outcome: RunOutcome.abandoned(reason),
    });

    abandoned.record(
      new RunAbandoned(this.id, this.workspaceId, this.subject, this.attempt),
    );

    return abandoned;
  }

  private backOnTheQueue(): Run {
    return this.with({
      state: 'queued',
      claimedBy: null,
      leaseExpiresAt: null,
      attempt: this.attempt + 1,
    });
  }

  release(): Run {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot be released while it is ${this.state}`,
      );
    }

    return this.backOnTheQueue();
  }

  renewLease(by: RunnerId, now: Date): Run {
    this.requireHeldBy(by, 'renew the lease on');

    return this.with({ leaseExpiresAt: this.leaseFrom(now) });
  }

  complete(
    by: RunnerId,
    outcome: RunOutcome,
    said: HandoverReport = HandoverReport.none(),
  ): Run {
    this.requireHeldBy(by, 'complete');

    const ended = this.with({
      state: outcome.failed ? 'failed' : 'completed',
      outcome,
      leaseExpiresAt: null,
    });

    ended.record(
      new RunCompleted(
        this.id,
        this.workspaceId,
        this.subject,
        outcome,
        by,
        said.declared ?? null,
        said.session ?? null,
      ),
    );

    return ended;
  }

  withdrawn(reason: string): Run {
    if (this.state !== 'queued') {
      throw new InvalidRunTransitionError(
        `cannot be withdrawn while it is ${this.state}`,
      );
    }

    const withdrawn = this.with({
      state: 'failed',
      outcome: RunOutcome.abandoned(reason),
    });

    withdrawn.record(new RunWithdrawn(this.id, this.workspaceId, this.subject));

    return withdrawn;
  }

  requestStop(now: Date): Run {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot be stopped while it is ${this.state}`,
      );
    }

    if (this.stopRequested) {
      return this;
    }

    const stopping = this.with({ stopRequestedAt: now });

    stopping.record(new RunStopRequested(this.id, this.subject, now));

    return stopping;
  }

  get hasEnded(): boolean {
    return this.state === 'completed' || this.state === 'failed';
  }

  get stopRequested(): boolean {
    return this.stopRequestedAt !== null;
  }

  wasWorkedBy(runner: RunnerId): boolean {
    return this.claimedBy?.equals(runner) ?? false;
  }

  assertHeldBy(by: RunnerId): void {
    this.requireHeldBy(by, 'act on');
  }

  journalFor(by: RunnerId): RunAttempt {
    this.requireHeldBy(by, 'journal');

    return RunAttempt.of(this.id, this.attempt);
  }

  wasGiven(tool: Tool): boolean {
    return this.spec.gives(tool);
  }

  lapsed(now: Date): boolean {
    return (
      this.state === 'claimed' &&
      this.leaseExpiresAt !== null &&
      this.leaseExpiresAt.getTime() <= now.getTime()
    );
  }

  private with(part: {
    state?: RunState;
    claimedBy?: RunnerId | null;
    leaseExpiresAt?: Date | null;
    outcome?: RunOutcome | null;
    attempt?: number;
    stopRequestedAt?: Date | null;
  }): Run {
    const next = new Run(
      this.id,
      this.workspaceId,
      this.harness,
      this.priority,
      this.subject,
      this.spec,
      this.targetRunner,
      part.state ?? this.state,
      part.claimedBy !== undefined ? part.claimedBy : this.claimedBy,
      part.leaseExpiresAt !== undefined
        ? part.leaseExpiresAt
        : this.leaseExpiresAt,
      part.outcome !== undefined ? part.outcome : this.outcome,
      part.attempt ?? this.attempt,
      part.stopRequestedAt !== undefined
        ? part.stopRequestedAt
        : this.stopRequestedAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }

  private leaseFrom(now: Date): Date {
    return new Date(now.getTime() + LEASE_DURATION_MS);
  }

  private requireHeldBy(by: RunnerId, action: string): void {
    if (this.state !== 'claimed') {
      throw new InvalidRunTransitionError(
        `cannot ${action} a run that is ${this.state}`,
      );
    }
    if (!this.claimedBy?.equals(by)) {
      throw new InvalidRunTransitionError(
        `cannot ${action} a run claimed by another runner`,
      );
    }
  }
}
