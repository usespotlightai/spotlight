import { SideBySideJudged } from '@insights/domain/events/side-by-side-judged.event';
import { SideBySideJudgingFailed } from '@insights/domain/events/side-by-side-judging-failed.event';
import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { MAX_REASONS } from '@insights/domain/services/grounded-verdict';
import type {
  PairCitedReason,
  PairEvidence,
} from '@insights/domain/services/pair-evidence';
import type { JudgeCriteria } from '@insights/domain/value-objects/judge-criteria.vo';
import { JudgingFailure } from '@insights/domain/value-objects/judging-failure.vo';
import {
  oppositeOf,
  PAIR_LABELS,
  type PairLabel,
  type PairOrder,
  type PairWinner,
  pairOrderOf,
  winnerOf,
} from '@insights/domain/value-objects/pair-order';
import type { PairReason } from '@insights/domain/value-objects/pair-reason.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import {
  type ModelCall,
  ModelUsage,
} from '@shared-kernel/domain/value-objects/model-usage.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PairVerdict {
  readonly preferred: PairLabel;
  readonly reasons: readonly PairCitedReason[];
}

export interface PairShown {
  readonly verdict: PairVerdict;
  readonly evidence: PairEvidence;
}

export interface PairPass {
  readonly runShownFirst: boolean;
  readonly winner: PairWinner;
  readonly reasons: readonly PairReason[];
}

const UNREADABLE = 'unreadable';

const UNGROUNDED = 'ungrounded';

const passOf = (
  shown: PairShown,
): PairPass | typeof UNREADABLE | typeof UNGROUNDED => {
  const stated = shown.verdict.reasons;

  if (
    !PAIR_LABELS.includes(shown.verdict.preferred) ||
    stated.length === 0 ||
    stated.length > MAX_REASONS
  ) {
    return UNREADABLE;
  }

  const reasons = shown.evidence.groundedReasons(stated);

  if (reasons.length * 2 <= stated.length) {
    return UNGROUNDED;
  }

  return {
    runShownFirst: shown.evidence.order === 'run-first',
    winner: winnerOf(shown.evidence.order, shown.verdict.preferred),
    reasons,
  };
};

interface State {
  readonly runId: RunId;
  readonly otherRunId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId;
  readonly maxAttempts: number;
  readonly order: PairOrder;
  readonly queuedAt: Date;
  readonly job: PendingJob | null;
  readonly judgedAt: Date | null;
  readonly failure: JudgingFailure | null;
  readonly spent: ModelUsage;
  readonly version: number;
}

export class SideBySideJudging
  extends EventRecorder
  implements HasPendingJob<SideBySideJudging>
{
  private constructor(private readonly state: State) {
    super();
  }

  static requested(input: {
    runId: RunId;
    otherRunId: RunId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    criteria: JudgeCriteria;
    reference: RunId;
    maxAttempts: number;
    now: Date;
  }): SideBySideJudging {
    if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) {
      throw InvalidScoreError.ofJudging(
        'attempts must be from 1 to the number paid for',
      );
    }
    if (
      input.runId.equals(input.otherRunId) ||
      input.reference.equals(input.runId) ||
      input.reference.equals(input.otherRunId)
    ) {
      throw InvalidScoreError.ofJudging(
        'must compare two different runs against an accepted third',
      );
    }

    return new SideBySideJudging({
      ...input,
      order: pairOrderOf(input.runId, input.otherRunId),
      queuedAt: input.now,
      job: PendingJob.fresh(),
      judgedAt: null,
      failure: null,
      spent: ModelUsage.none(),
      version: 0,
    });
  }

  static rehydrate(state: State): SideBySideJudging {
    const outcomes = [state.job, state.judgedAt, state.failure].filter(
      (each) => each !== null,
    );

    if (outcomes.length !== 1) {
      throw new InconsistentStateError(
        'side-by-side judging',
        'is either pending, judged or failed, and only one of these',
      );
    }
    if (state.order !== pairOrderOf(state.runId, state.otherRunId)) {
      throw new InconsistentStateError(
        'side-by-side judging',
        'shows its two changes in the order drawn from their runs',
      );
    }

    return new SideBySideJudging(state);
  }

  get runId(): RunId {
    return this.state.runId;
  }

  get otherRunId(): RunId {
    return this.state.otherRunId;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get criteria(): JudgeCriteria {
    return this.state.criteria;
  }

  get reference(): RunId {
    return this.state.reference;
  }

  get maxAttempts(): number {
    return this.state.maxAttempts;
  }

  get order(): PairOrder {
    return this.state.order;
  }

  get queuedAt(): Date {
    return this.state.queuedAt;
  }

  get job(): PendingJob | null {
    return this.state.job;
  }

  get judgedAt(): Date | null {
    return this.state.judgedAt;
  }

  get failure(): JudgingFailure | null {
    return this.state.failure;
  }

  get spent(): ModelUsage {
    return this.state.spent;
  }

  get version(): number {
    return this.state.version;
  }

  get hasPendingJob(): boolean {
    return this.state.job !== null;
  }

  get jobExhausted(): boolean {
    return this.state.job?.exhausted ?? false;
  }

  leaseJob(now: Date): SideBySideJudging {
    const job = this.state.job;

    if (!job) {
      throw InvalidScoreError.ofJudging('is already done');
    }
    if (!job.isDue(now) || job.exhausted) {
      throw InvalidScoreError.ofJudging('cannot be retried yet');
    }

    return this.with({ job: job.lease(now) });
  }

  scheduleRetry(now: Date): SideBySideJudging {
    return this.failed(JudgingFailure.of('errored', now));
  }

  deadLetter(now: Date): SideBySideJudging {
    return this.ended(JudgingFailure.of('interrupted', now));
  }

  failed(failure: JudgingFailure): SideBySideJudging {
    const job = this.state.job;

    if (!job) {
      return this;
    }

    const next =
      job.attempts < this.state.maxAttempts
        ? failure.retry.nextAttemptAt(job.attempts, failure.at)
        : null;

    return next
      ? this.with({ job: job.scheduleRetryAt(next) })
      : this.ended(failure);
  }

  recordModel(usage: ModelCall | null): SideBySideJudging {
    return usage && this.state.job
      ? this.with({ spent: this.state.spent.with(usage) })
      : this;
  }

  get orders(): readonly PairOrder[] {
    return [this.state.order, oppositeOf(this.state.order)];
  }

  recordVerdict(input: {
    passes: readonly PairShown[];
    model: string;
    now: Date;
  }): SideBySideJudging {
    if (!this.state.job) {
      return this;
    }
    if (
      input.passes.length !== this.orders.length ||
      input.passes.some(
        (each, at) =>
          !each.evidence.isFor(this.state.runId, this.state.otherRunId) ||
          each.evidence.order !== this.orders[at],
      )
    ) {
      throw InvalidScoreError.ofJudging(
        'must judge its own two runs, once in each order',
      );
    }

    const checked = input.passes.map((each) => passOf(each));

    if (checked.some((each) => each === UNREADABLE)) {
      return this.failed(JudgingFailure.of('unreadable', input.now));
    }

    const passes = checked.filter(
      (each): each is PairPass => typeof each !== 'string',
    );

    if (passes.length !== checked.length) {
      return this.failed(JudgingFailure.of('ungrounded', input.now));
    }

    const [first, second] = passes as [PairPass, PairPass];
    const judged = this.with({
      job: null,
      judgedAt: input.now,
      failure: null,
    });
    judged.record(
      new SideBySideJudged(
        this.state.runId,
        this.state.otherRunId,
        this.state.workspaceId,
        first.winner === second.winner ? first.winner : 'tie',
        input.model,
        passes,
        judged.spent,
        input.now,
      ),
    );
    return judged;
  }

  private ended(failure: JudgingFailure): SideBySideJudging {
    if (!this.state.job) {
      return this;
    }

    const ended = this.with({ job: null, failure });
    ended.record(
      new SideBySideJudgingFailed(
        this.state.runId,
        this.state.otherRunId,
        this.state.workspaceId,
        failure,
        this.state.spent,
      ),
    );
    return ended;
  }

  private with(part: Partial<State>): SideBySideJudging {
    const next = new SideBySideJudging({ ...this.state, ...part });

    next.inheritEvents(this);

    return next;
  }
}
