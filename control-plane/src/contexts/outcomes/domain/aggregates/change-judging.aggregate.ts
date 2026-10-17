import { ChangeJudged } from '@outcomes/domain/events/change-judged.event';
import { ChangeJudgingFailed } from '@outcomes/domain/events/change-judging-failed.event';
import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import {
  groundedVerdict,
  type Verdict,
} from '@outcomes/domain/services/grounded-verdict';
import type { JudgeEvidence } from '@outcomes/domain/services/judge-evidence';
import type { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import type { JudgingRound } from '@outcomes/domain/value-objects/judging-round';
import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
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

interface State {
  readonly runId: RunId;
  readonly round: JudgingRound;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly criteria: JudgeCriteria;
  readonly reference: RunId | null;
  readonly askedAt: Date;
  readonly work: OwedWork | null;
  readonly judgedAt: Date | null;
  readonly failure: JudgingFailure | null;
  readonly spent: ModelUsage;
  readonly version: number;
}

export class ChangeJudging
  extends EventRecorder
  implements OwesWork<ChangeJudging>
{
  private constructor(private readonly state: State) {
    super();
  }

  static asked(input: {
    runId: RunId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    criteria: JudgeCriteria;
    reference: RunId | null;
    now: Date;
  }): ChangeJudging {
    if (input.reference?.equals(input.runId)) {
      throw InvalidScoreError.ofJudging(
        'must compare a change with another run’s',
      );
    }

    return new ChangeJudging({
      runId: input.runId,
      round: 1,
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      criteria: input.criteria,
      reference: input.reference,
      askedAt: input.now,
      work: OwedWork.fresh(),
      judgedAt: null,
      failure: null,
      spent: ModelUsage.none(),
      version: 0,
    });
  }

  static rehydrate(state: State): ChangeJudging {
    const outcomes = [state.work, state.judgedAt, state.failure].filter(
      (each) => each !== null,
    );

    if (outcomes.length !== 1) {
      throw new InconsistentStateError(
        'change judging',
        'is either still owed, judged or failed, and only one of these',
      );
    }

    return new ChangeJudging(state);
  }

  get runId(): RunId {
    return this.state.runId;
  }

  get round(): JudgingRound {
    return this.state.round;
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

  get scale(): ScoreScale {
    return this.state.criteria.scale;
  }

  get reference(): RunId | null {
    return this.state.reference;
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

  askedAgain(now: Date): ChangeJudging {
    if (this.state.round !== 1 || this.state.judgedAt === null) {
      throw InvalidScoreError.ofJudging(
        'can be asked again only of a change judged once',
      );
    }

    return new ChangeJudging({
      ...this.state,
      round: 2,
      askedAt: now,
      work: OwedWork.fresh(),
      judgedAt: null,
      failure: null,
      spent: ModelUsage.none(),
      version: 0,
    });
  }

  get owesWork(): boolean {
    return this.state.work !== null;
  }

  get workExhausted(): boolean {
    return this.state.work?.exhausted ?? false;
  }

  leased(now: Date): ChangeJudging {
    const work = this.state.work;

    if (!work) {
      throw InvalidScoreError.ofJudging('is already done');
    }
    if (!work.dueBy(now) || work.exhausted) {
      throw InvalidScoreError.ofJudging('cannot be retried yet');
    }

    return this.with({ work: work.leased(now) });
  }

  triedAgainLater(now: Date): ChangeJudging {
    return this.failed(JudgingFailure.of('errored', now));
  }

  gaveUp(now: Date): ChangeJudging {
    return this.ended(JudgingFailure.of('interrupted', now));
  }

  failed(failure: JudgingFailure): ChangeJudging {
    const work = this.state.work;

    if (!work) {
      return this;
    }

    const next = failure.retry.after(work.attempts, failure.at);

    return next
      ? this.with({ work: work.waitingUntil(next) })
      : this.ended(failure);
  }

  recordModel(usage: ModelCall | null): ChangeJudging {
    return usage && this.state.work
      ? this.with({ spent: this.state.spent.with(usage) })
      : this;
  }

  recordVerdict(input: {
    verdict: Verdict;
    usage: ModelCall | null;
    evidence: JudgeEvidence;
    model: string;
    now: Date;
  }): ChangeJudging {
    if (!this.state.work) {
      return this;
    }

    if (!input.evidence.isFor(this.state.runId)) {
      throw InvalidScoreError.ofJudging('must use only its own run’s evidence');
    }

    const spending = this.recordModel(input.usage);
    const grounded = groundedVerdict(
      this.state.criteria,
      input.verdict,
      input.evidence,
    );

    if (!grounded.grounded) {
      return spending.failed(JudgingFailure.of(grounded.failure, input.now));
    }

    const judged = spending.with({
      work: null,
      judgedAt: input.now,
      failure: null,
    });
    judged.record(
      new ChangeJudged(
        this.state.runId,
        this.state.round,
        this.state.workspaceId,
        this.state.criteria.scale,
        grounded.value,
        grounded.marks,
        this.state.criteria.claims,
        this.state.criteria.passShare,
        input.model,
        grounded.reasons,
        input.evidence.reference !== null,
        judged.spent,
        input.now,
      ),
    );
    return judged;
  }

  private ended(failure: JudgingFailure): ChangeJudging {
    if (!this.state.work) {
      return this;
    }

    const ended = this.with({ work: null, failure });
    ended.record(
      new ChangeJudgingFailed(
        this.state.runId,
        this.state.round,
        this.state.workspaceId,
        failure,
        this.state.spent,
      ),
    );
    return ended;
  }

  private with(part: Partial<State>): ChangeJudging {
    const next = new ChangeJudging({ ...this.state, ...part });

    next.inheritEvents(this);

    return next;
  }
}
