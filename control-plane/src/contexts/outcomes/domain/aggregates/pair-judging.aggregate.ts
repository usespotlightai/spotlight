import { PairJudged } from '@outcomes/domain/events/pair-judged.event';
import { PairJudgingFailed } from '@outcomes/domain/events/pair-judging-failed.event';
import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import { MAX_REASONS } from '@outcomes/domain/services/grounded-verdict';
import type {
  PairCitedReason,
  PairEvidence,
} from '@outcomes/domain/services/pair-evidence';
import type { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import {
  oppositeOf,
  PAIR_LABELS,
  type PairLabel,
  type PairOrder,
  type PairWinner,
  pairOrderOf,
  winnerOf,
} from '@outcomes/domain/value-objects/pair-order';
import type { PairReason } from '@outcomes/domain/value-objects/pair-reason.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { OwesWork } from '@shared-kernel/domain/owes-work';
import {
  type ModelCall,
  ModelUsage,
} from '@shared-kernel/domain/value-objects/model-usage.vo';
import { OwedWork } from '@shared-kernel/domain/value-objects/owed-work.vo';
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

export interface PairReading {
  readonly runShownFirst: boolean;
  readonly winner: PairWinner;
  readonly reasons: readonly PairReason[];
}

const UNREADABLE = 'unreadable';

const UNGROUNDED = 'ungrounded';

const readingOf = (
  shown: PairShown,
): PairReading | typeof UNREADABLE | typeof UNGROUNDED => {
  const given = shown.verdict.reasons;

  if (
    !PAIR_LABELS.includes(shown.verdict.preferred) ||
    given.length === 0 ||
    given.length > MAX_REASONS
  ) {
    return UNREADABLE;
  }

  const reasons = shown.evidence.groundedReasons(given);

  if (reasons.length * 2 <= given.length) {
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
  readonly against: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId;
  readonly maxAttempts: number;
  readonly order: PairOrder;
  readonly askedAt: Date;
  readonly work: OwedWork | null;
  readonly judgedAt: Date | null;
  readonly failure: JudgingFailure | null;
  readonly spent: ModelUsage;
  readonly version: number;
}

export class PairJudging
  extends EventRecorder
  implements OwesWork<PairJudging>
{
  private constructor(private readonly state: State) {
    super();
  }

  static asked(input: {
    runId: RunId;
    against: RunId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    criteria: JudgeCriteria;
    reference: RunId;
    maxAttempts: number;
    now: Date;
  }): PairJudging {
    if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) {
      throw InvalidScoreError.ofJudging(
        'attempts must be from 1 to the number paid for',
      );
    }
    if (
      input.runId.equals(input.against) ||
      input.reference.equals(input.runId) ||
      input.reference.equals(input.against)
    ) {
      throw InvalidScoreError.ofJudging(
        'must compare two different runs against an accepted third',
      );
    }

    return new PairJudging({
      ...input,
      order: pairOrderOf(input.runId, input.against),
      askedAt: input.now,
      work: OwedWork.fresh(),
      judgedAt: null,
      failure: null,
      spent: ModelUsage.none(),
      version: 0,
    });
  }

  static rehydrate(state: State): PairJudging {
    const settled = [state.work, state.judgedAt, state.failure].filter(
      (each) => each !== null,
    );

    if (settled.length !== 1) {
      throw new InconsistentStateError(
        'pair judging',
        'is either still owed, judged or failed, and only one of these',
      );
    }
    if (state.order !== pairOrderOf(state.runId, state.against)) {
      throw new InconsistentStateError(
        'pair judging',
        'shows its two changes in the order drawn from their runs',
      );
    }

    return new PairJudging(state);
  }

  get runId(): RunId {
    return this.state.runId;
  }

  get against(): RunId {
    return this.state.against;
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

  get askedAt(): Date {
    return this.state.askedAt;
  }

  get work(): OwedWork | null {
    return this.state.work;
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

  get owesWork(): boolean {
    return this.state.work !== null;
  }

  get workExhausted(): boolean {
    return this.state.work?.exhausted ?? false;
  }

  leased(now: Date): PairJudging {
    const work = this.state.work;

    if (!work) {
      throw InvalidScoreError.ofJudging('is already done');
    }
    if (!work.dueBy(now) || work.exhausted) {
      throw InvalidScoreError.ofJudging('cannot be retried yet');
    }

    return this.with({ work: work.leased(now) });
  }

  triedAgainLater(now: Date): PairJudging {
    return this.failed(JudgingFailure.of('errored', now));
  }

  gaveUp(now: Date): PairJudging {
    return this.ended(JudgingFailure.of('interrupted', now));
  }

  failed(failure: JudgingFailure): PairJudging {
    const work = this.state.work;

    if (!work) {
      return this;
    }

    const next =
      work.attempts < this.state.maxAttempts
        ? failure.retry.after(work.attempts, failure.at)
        : null;

    return next
      ? this.with({ work: work.waitingUntil(next) })
      : this.ended(failure);
  }

  recordModel(usage: ModelCall | null): PairJudging {
    return usage && this.state.work
      ? this.with({ spent: this.state.spent.with(usage) })
      : this;
  }

  get orders(): readonly PairOrder[] {
    return [this.state.order, oppositeOf(this.state.order)];
  }

  recordVerdict(input: {
    readings: readonly PairShown[];
    model: string;
    now: Date;
  }): PairJudging {
    if (!this.state.work) {
      return this;
    }
    if (
      input.readings.length !== this.orders.length ||
      input.readings.some(
        (each, at) =>
          !each.evidence.isFor(this.state.runId, this.state.against) ||
          each.evidence.order !== this.orders[at],
      )
    ) {
      throw InvalidScoreError.ofJudging(
        'must judge its own two runs, once in each order',
      );
    }

    const read = input.readings.map((each) => readingOf(each));

    if (read.some((each) => each === UNREADABLE)) {
      return this.failed(JudgingFailure.of('unreadable', input.now));
    }

    const readings = read.filter(
      (each): each is PairReading => typeof each !== 'string',
    );

    if (readings.length !== read.length) {
      return this.failed(JudgingFailure.of('ungrounded', input.now));
    }

    const [first, second] = readings as [PairReading, PairReading];
    const judged = this.with({
      work: null,
      judgedAt: input.now,
      failure: null,
    });
    judged.record(
      new PairJudged(
        this.state.runId,
        this.state.against,
        this.state.workspaceId,
        first.winner === second.winner ? first.winner : 'tie',
        input.model,
        readings,
        judged.spent,
        input.now,
      ),
    );
    return judged;
  }

  private ended(failure: JudgingFailure): PairJudging {
    if (!this.state.work) {
      return this;
    }

    const ended = this.with({ work: null, failure });
    ended.record(
      new PairJudgingFailed(
        this.state.runId,
        this.state.against,
        this.state.workspaceId,
        failure,
        this.state.spent,
      ),
    );
    return ended;
  }

  private with(part: Partial<State>): PairJudging {
    const next = new PairJudging({ ...this.state, ...part });

    next.inheritEvents(this);

    return next;
  }
}
