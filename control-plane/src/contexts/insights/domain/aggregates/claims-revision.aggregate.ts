import { ClaimsRevisionEnded } from '@insights/domain/events/claims-revision-ended.event';
import { ClaimsRevisionPicked } from '@insights/domain/events/claims-revision-picked.event';
import { ClaimsRevisionStarted } from '@insights/domain/events/claims-revision-started.event';
import { InvalidClaimsRevisionError } from '@insights/domain/exceptions/invalid-claims-revision.error';
import {
  MAX_REVISION_JUDGE_CALLS,
  type PickedCandidate,
} from '@insights/domain/services/revision-pick';
import {
  REVISION_COOLDOWN_MS,
  type RevisionTrigger,
} from '@insights/domain/services/revision-trigger';
import type { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import {
  type RevisionEndReason,
  RevisionOutcome,
} from '@insights/domain/value-objects/revision-outcome.vo';
import type { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PULL_REQUEST_DEADLINE_MS = 24 * 60 * 60 * 1000;

const PULL_REQUEST_OVERDUE =
  'Spotlight got no pull request within a day of the pick.';

export interface RevisedStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly stationId: StationId;
}

interface ClaimsRevisionFields {
  readonly id: ClaimsRevisionId;
  readonly station: RevisedStation;
  readonly rubric: Rubric;
  readonly trigger: RevisionTrigger;
  readonly startedAt: Date;
  readonly job: PendingJob | null;
  readonly judgeCalls: number;
  readonly pick: PickedCandidate | null;
  readonly pickedAt: Date | null;
  readonly outcome: RevisionOutcome | null;
  readonly endedAt: Date | null;
  readonly version: number;
}

export class ClaimsRevision
  extends EventRecorder
  implements HasPendingJob<ClaimsRevision>
{
  private deleted = false;

  private constructor(private readonly fields: ClaimsRevisionFields) {
    super();
  }

  static mayStart(latest: ClaimsRevision | null, now: Date): boolean {
    if (!latest) {
      return true;
    }
    if (!latest.fields.endedAt) {
      return false;
    }

    return (
      now.getTime() - latest.fields.endedAt.getTime() >= REVISION_COOLDOWN_MS
    );
  }

  static started(input: {
    id: ClaimsRevisionId;
    station: RevisedStation;
    rubric: Rubric;
    trigger: RevisionTrigger;
    latest: ClaimsRevision | null;
    now: Date;
  }): ClaimsRevision {
    if (!ClaimsRevision.mayStart(input.latest, input.now)) {
      throw new InvalidClaimsRevisionError(
        'starts only when the station has no open revision and the last one ended at least 7 days ago',
      );
    }

    const revision = new ClaimsRevision({
      id: input.id,
      station: input.station,
      rubric: input.rubric,
      trigger: input.trigger,
      startedAt: input.now,
      job: PendingJob.fresh(),
      judgeCalls: 0,
      pick: null,
      pickedAt: null,
      outcome: null,
      endedAt: null,
      version: 0,
    });
    revision.record(
      new ClaimsRevisionStarted(
        input.id,
        input.station.workspaceId,
        input.station.stationId,
        input.rubric.version,
        input.trigger,
      ),
    );

    return revision;
  }

  static rehydrate(fields: ClaimsRevisionFields): ClaimsRevision {
    const phases = [
      fields.job,
      fields.pick && !fields.outcome ? fields.pick : null,
      fields.outcome,
    ].filter((each) => each !== null).length;

    if (
      phases !== 1 ||
      (fields.outcome === null) !== (fields.endedAt === null) ||
      (fields.pick === null) !== (fields.pickedAt === null) ||
      (fields.job !== null && fields.pick !== null)
    ) {
      throw new InconsistentStateError(
        'claims revision',
        'is running, waits for its pull request with a picked candidate, or ended with an outcome and a time',
      );
    }

    return new ClaimsRevision(fields);
  }

  get id(): ClaimsRevisionId {
    return this.fields.id;
  }

  get station(): RevisedStation {
    return this.fields.station;
  }

  get rubric(): Rubric {
    return this.fields.rubric;
  }

  get trigger(): RevisionTrigger {
    return this.fields.trigger;
  }

  get startedAt(): Date {
    return this.fields.startedAt;
  }

  get job(): PendingJob | null {
    return this.fields.job;
  }

  get judgeCalls(): number {
    return this.fields.judgeCalls;
  }

  get pick(): PickedCandidate | null {
    return this.fields.pick;
  }

  get pickedAt(): Date | null {
    return this.fields.pickedAt;
  }

  get awaitsPullRequest(): boolean {
    return this.fields.pick !== null && this.fields.outcome === null;
  }

  get judgeCallsLeft(): number {
    return MAX_REVISION_JUDGE_CALLS - this.fields.judgeCalls;
  }

  get outcome(): RevisionOutcome | null {
    return this.fields.outcome;
  }

  get endedAt(): Date | null {
    return this.fields.endedAt;
  }

  get version(): number {
    return this.fields.version;
  }

  get hasPendingJob(): boolean {
    return this.fields.job !== null;
  }

  get jobExhausted(): boolean {
    return this.fields.job?.exhausted ?? false;
  }

  leaseJob(now: Date): ClaimsRevision {
    const { job } = this.fields;

    if (!job) {
      throw new InvalidClaimsRevisionError('has already ended');
    }
    if (!job.isDue(now) || job.exhausted) {
      throw new InvalidClaimsRevisionError('cannot be retried yet');
    }

    return this.with({ job: job.lease(now) });
  }

  scheduleRetry(now: Date): ClaimsRevision {
    const { job } = this.fields;

    return job ? this.with({ job: job.scheduleRetry(now) }) : this;
  }

  deadLetter(now: Date): ClaimsRevision {
    return this.ended({ reason: 'interrupted', now });
  }

  spending(judgeCalls: number): ClaimsRevision {
    if (!this.fields.job) {
      throw new InvalidClaimsRevisionError('has already ended');
    }
    if (!Number.isInteger(judgeCalls) || judgeCalls < 0) {
      throw new InvalidClaimsRevisionError(
        'counts judge calls in whole numbers',
      );
    }
    if (judgeCalls > this.judgeCallsLeft) {
      throw new InvalidClaimsRevisionError(
        `makes at most ${MAX_REVISION_JUDGE_CALLS} judge calls`,
      );
    }

    return this.with({ judgeCalls: this.fields.judgeCalls + judgeCalls });
  }

  picked(input: { pick: PickedCandidate; now: Date }): ClaimsRevision {
    if (!this.fields.job) {
      throw new InvalidClaimsRevisionError(
        'picks a candidate only while it judges',
      );
    }

    const next = this.with({
      job: null,
      pick: input.pick,
      pickedAt: input.now,
    });
    next.record(
      new ClaimsRevisionPicked(
        this.fields.id,
        this.fields.station.workspaceId,
        this.fields.station.stationId,
      ),
    );

    return next;
  }

  proposed(input: { pullRequest: string; now: Date }): ClaimsRevision {
    const { pick } = this.fields;

    if (!pick || this.fields.outcome) {
      return this;
    }

    return this.closed(
      RevisionOutcome.proposed({
        claims: pick.claims,
        agreement: pick.agreement,
        pullRequest: input.pullRequest,
      }),
      input.now,
    );
  }

  pullRequestFailed(input: { message: string; now: Date }): ClaimsRevision {
    const { pick } = this.fields;

    if (!pick || this.fields.outcome) {
      return this;
    }

    return this.closed(
      RevisionOutcome.ended({
        reason: 'pull-request-failed',
        agreement: pick.agreement,
        message: input.message,
      }),
      input.now,
    );
  }

  get pullRequestDeadline(): Date | null {
    const { pickedAt } = this.fields;

    return this.awaitsPullRequest && pickedAt
      ? new Date(pickedAt.getTime() + PULL_REQUEST_DEADLINE_MS)
      : null;
  }

  pullRequestOverdue(now: Date): ClaimsRevision {
    const deadline = this.pullRequestDeadline;

    if (!deadline || now.getTime() <= deadline.getTime()) {
      return this;
    }

    return this.pullRequestFailed({
      message: PULL_REQUEST_OVERDUE,
      now: deadline,
    });
  }

  ended(input: {
    reason: RevisionEndReason;
    agreement?: PickedCandidate['agreement'] | null;
    message?: string | null;
    now: Date;
  }): ClaimsRevision {
    return this.fields.job
      ? this.closed(RevisionOutcome.ended(input), input.now)
      : this;
  }

  private closed(outcome: RevisionOutcome, now: Date): ClaimsRevision {
    if (this.fields.outcome) {
      return this;
    }

    const next = this.with({
      job: null,
      outcome,
      endedAt: now,
    });
    next.record(
      new ClaimsRevisionEnded(
        this.fields.id,
        this.fields.station.workspaceId,
        this.fields.station.stationId,
        outcome.kind,
      ),
    );

    return next;
  }

  private with(change: Partial<ClaimsRevisionFields>): ClaimsRevision {
    const next = new ClaimsRevision({ ...this.fields, ...change });
    next.inheritEvents(this);
    return next;
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  delete(): ClaimsRevision {
    const deleted = this.with({});
    deleted.deleted = true;
    return deleted;
  }
}
