import { JudgeDisagreementAnswered } from '@insights/domain/events/judge-disagreement-answered.event';
import { JudgeDisagreementClaimAnswered } from '@insights/domain/events/judge-disagreement-claim-answered.event';
import { JudgeDisagreementOpened } from '@insights/domain/events/judge-disagreement-opened.event';
import { JudgeDisagreementWithdrawn } from '@insights/domain/events/judge-disagreement-withdrawn.event';
import { ClaimNotInDisputeError } from '@insights/domain/exceptions/claim-not-in-dispute.error';
import { DisagreementClaimAnsweredError } from '@insights/domain/exceptions/disagreement-claim-answered.error';
import { InvalidJudgeDisagreementError } from '@insights/domain/exceptions/invalid-judge-disagreement.error';
import { JudgeDisagreementAnsweredError } from '@insights/domain/exceptions/judge-disagreement-answered.error';
import { JudgeDisagreementNotAskedOfYouError } from '@insights/domain/exceptions/judge-disagreement-not-asked-of-you.error';
import { JudgeDisagreementWithdrawnError } from '@insights/domain/exceptions/judge-disagreement-withdrawn.error';
import {
  ClaimAnswer,
  type ClaimAnswerKind,
} from '@insights/domain/value-objects/claim-answer.vo';
import {
  type DisagreementDirection,
  directionOf,
} from '@insights/domain/value-objects/disagreement-direction';
import type { DisagreementState } from '@insights/domain/value-objects/disagreement-state';
import type { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import type { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import {
  type LabelSource,
  passesOn,
} from '@insights/domain/value-objects/label-source';
import { NotMetAnswer } from '@insights/domain/value-objects/not-met-answer.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import type { WithdrawalReason } from '@insights/domain/value-objects/withdrawal-reason';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface DisagreementVerdict {
  readonly scoreId: ScoreId;
  readonly rubricVersion: RubricVersion;
  readonly claims: readonly string[];
  readonly claimResults: readonly boolean[];
  readonly passes: boolean;
  readonly reasons: readonly JudgeReason[];
}

interface JudgeDisagreementFields {
  readonly id: JudgeDisagreementId;
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly location: RunLocation;
  readonly verdict: DisagreementVerdict;
  readonly labelFrom: LabelSource;
  readonly askedOf: UserId | null;
  readonly openedAt: Date;
  readonly claimAnswers: readonly ClaimAnswer[];
  readonly notMet: NotMetAnswer | null;
  readonly answeredAt: Date | null;
  readonly withdrawnAt: Date | null;
  readonly withdrawnBecause: WithdrawalReason | null;
  readonly version: number;
}

const disputedOf = (verdict: DisagreementVerdict): readonly number[] =>
  verdict.passes
    ? []
    : verdict.claimResults.flatMap((met, at) => (met ? [] : [at]));

const brokenRuleOf = (
  verdict: DisagreementVerdict,
  labelFrom: LabelSource,
): string | null => {
  if (
    verdict.claims.length === 0 ||
    verdict.claims.length !== verdict.claimResults.length
  ) {
    return 'must keep one judge result for each claim';
  }
  if (verdict.passes === passesOn(labelFrom)) {
    return 'opens only where the judge and the person disagree';
  }
  if (!verdict.passes && disputedOf(verdict).length === 0) {
    return 'where the judge failed the run disputes at least one claim';
  }

  return null;
};

export class JudgeDisagreement extends EventRecorder {
  private deleted = false;

  private constructor(private readonly fields: JudgeDisagreementFields) {
    super();
  }

  static open(input: {
    id: JudgeDisagreementId;
    runId: RunId;
    workspaceId: WorkspaceId;
    location: RunLocation;
    verdict: DisagreementVerdict;
    labelFrom: LabelSource;
    askedOf: UserId | null;
    now: Date;
  }): JudgeDisagreement {
    const { verdict } = input;
    const broken = brokenRuleOf(verdict, input.labelFrom);

    if (broken) {
      throw new InvalidJudgeDisagreementError(broken);
    }

    const disagreement = new JudgeDisagreement({
      id: input.id,
      runId: input.runId,
      workspaceId: input.workspaceId,
      location: input.location,
      verdict,
      labelFrom: input.labelFrom,
      askedOf: input.askedOf,
      openedAt: input.now,
      claimAnswers: [],
      notMet: null,
      answeredAt: null,
      withdrawnAt: null,
      withdrawnBecause: null,
      version: 0,
    });
    disagreement.record(
      new JudgeDisagreementOpened(
        input.id,
        input.runId,
        input.workspaceId,
        input.location,
        verdict.rubricVersion,
        input.askedOf,
      ),
    );

    return disagreement;
  }

  static rehydrate(fields: JudgeDisagreementFields): JudgeDisagreement {
    const { verdict } = fields;
    const broken = brokenRuleOf(verdict, fields.labelFrom);

    if (broken) {
      throw new InconsistentStateError('judge disagreement', broken);
    }

    const claims = fields.claimAnswers.map((each) => each.claim);
    const disputed = disputedOf(verdict);

    if (claims.some((claim) => !disputed.includes(claim))) {
      throw new InconsistentStateError(
        'judge disagreement',
        'keeps answers only to claims in dispute',
      );
    }
    if ((fields.withdrawnAt === null) !== (fields.withdrawnBecause === null)) {
      throw new InconsistentStateError(
        'judge disagreement',
        'keeps a reason exactly when it is withdrawn',
      );
    }
    if (new Set(claims).size !== claims.length) {
      throw new InconsistentStateError(
        'judge disagreement',
        'keeps at most one answer for each of its claims',
      );
    }
    if (fields.notMet && !fields.verdict.passes) {
      throw new InconsistentStateError(
        'judge disagreement',
        'keeps what was not met only where the judge passed the run',
      );
    }
    const shouldHaveFailed = fields.notMet?.shouldHaveFailed ?? null;

    if (
      shouldHaveFailed !== null &&
      shouldHaveFailed >= verdict.claims.length
    ) {
      throw new InconsistentStateError(
        'judge disagreement',
        'keeps what was not met only on a claim of its judge',
      );
    }

    const complete = fields.notMet
      ? true
      : disputed.length > 0 &&
        disputed.every((claim) => claims.includes(claim));

    if ((fields.answeredAt !== null) !== complete) {
      throw new InconsistentStateError(
        'judge disagreement',
        'is answered exactly when it has an answer for each claim in dispute',
      );
    }

    return new JudgeDisagreement({
      ...fields,
      claimAnswers: [...fields.claimAnswers].sort(
        (one, other) => one.claim - other.claim,
      ),
      verdict,
    });
  }

  get id(): JudgeDisagreementId {
    return this.fields.id;
  }

  get runId(): RunId {
    return this.fields.runId;
  }

  get workspaceId(): WorkspaceId {
    return this.fields.workspaceId;
  }

  get location(): RunLocation {
    return this.fields.location;
  }

  get verdict(): DisagreementVerdict {
    return this.fields.verdict;
  }

  get rubricVersion(): RubricVersion {
    return this.fields.verdict.rubricVersion;
  }

  get direction(): DisagreementDirection {
    return directionOf(this.fields.verdict.passes);
  }

  get labelFrom(): LabelSource {
    return this.fields.labelFrom;
  }

  get askedOf(): UserId | null {
    return this.fields.askedOf;
  }

  get openedAt(): Date {
    return this.fields.openedAt;
  }

  get disputedClaims(): readonly number[] {
    return disputedOf(this.fields.verdict);
  }

  get claimAnswers(): readonly ClaimAnswer[] {
    return this.fields.claimAnswers;
  }

  get notMet(): NotMetAnswer | null {
    return this.fields.notMet;
  }

  get answeredAt(): Date | null {
    return this.fields.answeredAt;
  }

  get claimsWrong(): readonly number[] {
    const shouldHaveFailed = this.fields.notMet?.shouldHaveFailed ?? null;

    return [
      ...this.fields.claimAnswers
        .filter((each) => each.claimWrong)
        .map((each) => each.claim),
      ...(shouldHaveFailed === null ? [] : [shouldHaveFailed]),
    ];
  }

  get pointsToNoClaim(): boolean {
    return this.fields.notMet?.pointsToNoClaim ?? false;
  }

  get withdrawnAt(): Date | null {
    return this.fields.withdrawnAt;
  }

  get withdrawnBecause(): WithdrawalReason | null {
    return this.fields.withdrawnBecause;
  }

  get state(): DisagreementState {
    if (this.fields.withdrawnAt) {
      return 'withdrawn';
    }

    return this.fields.answeredAt ? 'answered' : 'open';
  }

  get isWithdrawn(): boolean {
    return this.state === 'withdrawn';
  }

  get version(): number {
    return this.fields.version;
  }

  noLongerHoldsBecause(input: {
    rubricVersion: RubricVersion | null;
    labelFrom: LabelSource | null;
  }): WithdrawalReason | null {
    if (input.rubricVersion !== this.rubricVersion) {
      return 'claims-changed';
    }
    if (!input.labelFrom) {
      return 'label-gone';
    }

    return passesOn(input.labelFrom) === this.fields.verdict.passes
      ? 'verdicts-agree'
      : null;
  }

  withdraw(now: Date, reason: WithdrawalReason): JudgeDisagreement {
    if (this.isWithdrawn) {
      return this;
    }

    const next = new JudgeDisagreement({
      ...this.fields,
      withdrawnAt: now,
      withdrawnBecause: reason,
    });
    next.inheritEvents(this);
    next.record(
      new JudgeDisagreementWithdrawn(
        this.fields.id,
        this.fields.runId,
        this.fields.workspaceId,
        this.fields.location,
        this.rubricVersion,
        reason,
      ),
    );

    return next;
  }

  answerClaim(input: {
    claim: number;
    answer: ClaimAnswerKind;
    note: string | null;
    by: UserId;
    now: Date;
  }): JudgeDisagreement {
    this.checkAnswerable(input.by);

    const disputed = this.disputedClaims;

    if (!disputed.includes(input.claim)) {
      throw new ClaimNotInDisputeError(this.fields.id.value, input.claim);
    }
    if (this.fields.claimAnswers.some((each) => each.claim === input.claim)) {
      throw new DisagreementClaimAnsweredError(
        this.fields.id.value,
        input.claim,
      );
    }

    const claimAnswers = [
      ...this.fields.claimAnswers,
      ClaimAnswer.of({
        claim: input.claim,
        answer: input.answer,
        note: input.note,
        by: input.by,
        at: input.now,
      }),
    ].sort((one, other) => one.claim - other.claim);
    const complete = disputed.every((claim) =>
      claimAnswers.some((each) => each.claim === claim),
    );
    const next = new JudgeDisagreement({
      ...this.fields,
      claimAnswers,
      answeredAt: complete ? input.now : null,
    });
    next.inheritEvents(this);
    next.record(
      new JudgeDisagreementClaimAnswered(
        this.fields.id,
        this.fields.runId,
        this.fields.workspaceId,
        this.fields.location,
        this.rubricVersion,
        input.claim,
      ),
    );
    if (complete) {
      next.recordAnswered();
    }

    return next;
  }

  answerNotMet(input: {
    shouldHaveFailed: number | null;
    note: string | null;
    by: UserId;
    now: Date;
  }): JudgeDisagreement {
    this.checkAnswerable(input.by);

    if (this.fields.notMet) {
      throw new JudgeDisagreementAnsweredError(this.fields.id.value);
    }
    if (this.direction !== 'judge-passed') {
      throw new InvalidJudgeDisagreementError(
        'with claims in dispute takes an answer for each of them, one by one',
      );
    }
    if (
      input.shouldHaveFailed !== null &&
      input.shouldHaveFailed >= this.fields.verdict.claims.length
    ) {
      throw new InvalidJudgeDisagreementError(
        'must name a claim of the judge that looked at the run',
      );
    }

    const next = new JudgeDisagreement({
      ...this.fields,
      notMet: NotMetAnswer.of({
        shouldHaveFailed: input.shouldHaveFailed,
        note: input.note,
        by: input.by,
        at: input.now,
      }),
      answeredAt: input.now,
    });
    next.inheritEvents(this);
    next.recordAnswered();

    return next;
  }

  private checkAnswerable(by: UserId): void {
    if (this.isWithdrawn) {
      throw new JudgeDisagreementWithdrawnError(this.fields.id.value);
    }
    if (this.fields.askedOf && !this.fields.askedOf.equals(by)) {
      throw new JudgeDisagreementNotAskedOfYouError(this.fields.id.value);
    }
  }

  private recordAnswered(): void {
    this.record(
      new JudgeDisagreementAnswered(
        this.fields.id,
        this.fields.runId,
        this.fields.workspaceId,
        this.fields.location,
        this.rubricVersion,
      ),
    );
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  delete(): JudgeDisagreement {
    const deleted = new JudgeDisagreement(this.fields);
    deleted.inheritEvents(this);
    deleted.deleted = true;
    return deleted;
  }
}
