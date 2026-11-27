import { ClaimsRevisionEnded } from '@insights/domain/events/claims-revision-ended.event';
import { ClaimsRevisionPicked } from '@insights/domain/events/claims-revision-picked.event';
import { ClaimsRevisionStarted } from '@insights/domain/events/claims-revision-started.event';
import { InvalidClaimsRevisionError } from '@insights/domain/exceptions/invalid-claims-revision.error';
import {
  MAX_REVISION_JUDGE_CALLS,
  type PickedCandidate,
} from '@insights/domain/services/revision-pick';
import {
  MIN_HELD_OUT,
  type RevisionSplit,
  revisableOf,
} from '@insights/domain/services/revision-split';
import {
  REVISION_COOLDOWN_MS,
  type RevisionTrigger,
} from '@insights/domain/services/revision-trigger';
import type { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import { ClaimsRevisionRound } from '@insights/domain/value-objects/claims-revision-round.vo';
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

/** The judge calls the round of `attempt` reserved before it ordered their sessions. */
export interface JudgeCallReservation {
  readonly attempt: number;
  readonly judgeCalls: number;
}

interface ClaimsRevisionFields {
  readonly id: ClaimsRevisionId;
  readonly station: RevisedStation;
  readonly rubric: Rubric;
  readonly trigger: RevisionTrigger;
  readonly startedAt: Date;
  readonly job: PendingJob | null;
  /** Judge calls spent by earlier rounds and reserved by the latest one. */
  readonly judgeCalls: number;
  readonly reservation: JudgeCallReservation | null;
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
      !latest.startsCooldown ||
      now.getTime() - latest.fields.endedAt.getTime() >= REVISION_COOLDOWN_MS
    );
  }

  static started(input: {
    id: ClaimsRevisionId;
    station: RevisedStation;
    rubric: Rubric;
    trigger: RevisionTrigger;
    latest: ClaimsRevision | null;
    /** The station's labelled runs, split as the revision will search and hold them out. */
    split: RevisionSplit<unknown>;
    now: Date;
  }): ClaimsRevision {
    if (!ClaimsRevision.mayStart(input.latest, input.now)) {
      throw new InvalidClaimsRevisionError(
        'starts only when the station has no open revision and the last one that judged candidates ended at least 7 days ago',
      );
    }
    if (!revisableOf(input.split)) {
      throw new InvalidClaimsRevisionError(
        `starts only when at least ${MIN_HELD_OUT} labelled runs are held out`,
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
      reservation: null,
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
      (fields.job !== null && fields.pick !== null) ||
      (fields.reservation !== null &&
        (fields.reservation.attempt < 1 ||
          fields.reservation.judgeCalls < 0 ||
          fields.reservation.judgeCalls > fields.judgeCalls))
    ) {
      throw new InconsistentStateError(
        'claims revision',
        'is running, waits for its pull request with a picked candidate, or ended with an outcome and a time, and counts what a round reserved among its judge calls',
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

  get reservation(): JudgeCallReservation | null {
    return this.fields.reservation;
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

  /** A revision that ended before it judged a candidate changed nothing, so the next one need not wait. */
  private get startsCooldown(): boolean {
    return this.fields.judgeCalls > 0;
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

  waitJob(now: Date): ClaimsRevision {
    return this.job ? this.with({ job: this.job.wait(now) }) : this;
  }

  /** The round the leased job runs. */
  get round(): ClaimsRevisionRound {
    if (!this.fields.job) {
      throw new InvalidClaimsRevisionError('has no round once it has ended');
    }

    return this.roundOf(this.fields.job.attempts);
  }

  /**
   * Makes the job due now when a session it waits on has settled. A waiting job handed its try back, so it waits
   * on the round of its next try; a job already due, or a session of any other round, is left as it is.
   */
  wake(round: ClaimsRevisionRound, now: Date): ClaimsRevision {
    const { job } = this.fields;

    if (
      !job ||
      job.isDue(now) ||
      !round.equals(this.roundOf(job.attempts + 1))
    ) {
      return this;
    }

    const woken = job.wake(now);

    return woken === job ? this : this.with({ job: woken });
  }

  /** The judge calls the round may make: those left, and those it reserved already. */
  judgeCallsLeftIn(round: ClaimsRevisionRound): number {
    return this.judgeCallsLeft + this.reservedIn(round);
  }

  /**
   * Reserves the round's judge calls before it orders their sessions, so the ceiling holds before anything is
   * spent. A round asked again reserves only the calls it has not reserved yet.
   */
  reserveJudgeCalls(
    round: ClaimsRevisionRound,
    judgeCalls: number,
  ): ClaimsRevision {
    if (!this.fields.job) {
      throw new InvalidClaimsRevisionError('has already ended');
    }
    if (!round.equals(this.round)) {
      throw new InvalidClaimsRevisionError(
        'reserves judge calls only for the round it runs',
      );
    }
    if (!Number.isInteger(judgeCalls) || judgeCalls < 0) {
      throw new InvalidClaimsRevisionError(
        'counts judge calls in whole numbers',
      );
    }

    const reserved = this.reservedIn(round);

    if (judgeCalls <= reserved) {
      return this;
    }
    if (judgeCalls > this.judgeCallsLeftIn(round)) {
      throw new InvalidClaimsRevisionError(
        `makes at most ${MAX_REVISION_JUDGE_CALLS} judge calls`,
      );
    }

    return this.with({
      judgeCalls: this.fields.judgeCalls - reserved + judgeCalls,
      reservation: { attempt: round.attempt, judgeCalls },
    });
  }

  /** A drafting session that failed is drafted again in a new round, until the job runs out of tries. */
  draftingFailed(now: Date): ClaimsRevision {
    return this.scheduleRetry(now);
  }

  /** Ends the revision when its sessions have nowhere to run: no harness, or a run of another workspace. */
  unavailable(now: Date): ClaimsRevision {
    return this.ended({ reason: 'unavailable', now });
  }

  deadLetter(now: Date): ClaimsRevision {
    return this.ended({ reason: 'interrupted', now });
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

  private roundOf(attempt: number): ClaimsRevisionRound {
    return ClaimsRevisionRound.of({ revisionId: this.fields.id, attempt });
  }

  private reservedIn(round: ClaimsRevisionRound): number {
    const { reservation } = this.fields;

    return reservation && round.equals(this.roundOf(reservation.attempt))
      ? reservation.judgeCalls
      : 0;
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
