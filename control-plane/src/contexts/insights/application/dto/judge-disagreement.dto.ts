import type { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import type { LabelSource } from '@insights/domain/services/human-label';
import type { CitationKind } from '@insights/domain/value-objects/citation.vo';
import type { ClaimAnswerKind } from '@insights/domain/value-objects/claim-answer.vo';
import type { DisagreementDirection } from '@insights/domain/value-objects/disagreement-direction';
import type { DisagreementState } from '@insights/domain/value-objects/disagreement-state';
import type { WithdrawalReason } from '@insights/domain/value-objects/withdrawal-reason';

export interface DisagreementCitationDto {
  readonly kind: CitationKind;
  readonly step: number | null;
  readonly hunk: string | null;
}

export interface DisagreementReasonDto {
  readonly text: string;
  readonly citations: readonly DisagreementCitationDto[];
}

export interface DisagreementClaimDto {
  readonly index: number;
  readonly text: string;
  readonly judgeMet: boolean;
  readonly reasons: readonly DisagreementReasonDto[];
}

export interface ClaimAnswerDto {
  readonly claim: number;
  readonly answer: ClaimAnswerKind;
  readonly note: string | null;
  readonly answeredBy: string;
  readonly answeredAt: string;
}

export interface NotMetAnswerDto {
  readonly claim: number | null;
  readonly note: string | null;
  readonly answeredBy: string;
  readonly answeredAt: string;
}

export interface JudgeDisagreementDto {
  readonly id: string;
  readonly runId: string;
  readonly taskId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly rubricVersion: string;
  readonly direction: DisagreementDirection;
  readonly state: DisagreementState;
  readonly labelFrom: LabelSource;
  readonly askedOf: string | null;
  readonly openedAt: string;
  readonly claims: readonly DisagreementClaimDto[];
  readonly disputedClaims: readonly number[];
  readonly answers: readonly ClaimAnswerDto[];
  readonly notMet: NotMetAnswerDto | null;
  readonly withdrawnAt: string | null;
  readonly withdrawnBecause: WithdrawalReason | null;
}

export const judgeDisagreementDtoOf = (
  disagreement: JudgeDisagreement,
): JudgeDisagreementDto => {
  const { verdict, location, notMet } = disagreement;

  return {
    id: disagreement.id.value,
    runId: disagreement.runId.value,
    taskId: location.taskId.value,
    lineId: location.lineId.value,
    stationId: location.stationId.value,
    rubricVersion: disagreement.rubricVersion,
    direction: disagreement.direction,
    state: disagreement.state,
    labelFrom: disagreement.labelFrom,
    askedOf: disagreement.askedOf?.value ?? null,
    openedAt: disagreement.openedAt.toISOString(),
    claims: verdict.claims.map((text, index) => ({
      index,
      text,
      judgeMet: verdict.claimResults[index] ?? false,
      reasons: verdict.reasons
        .filter((each) => each.claim === index)
        .map((each) => ({
          text: each.text,
          citations: each.citations.map((citation) => ({
            kind: citation.kind,
            step: citation.step,
            hunk: citation.hunk,
          })),
        })),
    })),
    disputedClaims: disagreement.disputedClaims,
    answers: disagreement.claimAnswers.map((each) => ({
      claim: each.claim,
      answer: each.answer,
      note: each.note,
      answeredBy: each.by.value,
      answeredAt: each.at.toISOString(),
    })),
    notMet: notMet
      ? {
          claim: notMet.shouldHaveFailed,
          note: notMet.note,
          answeredBy: notMet.by.value,
          answeredAt: notMet.at.toISOString(),
        }
      : null,
    withdrawnAt: disagreement.withdrawnAt?.toISOString() ?? null,
    withdrawnBecause: disagreement.withdrawnBecause,
  };
};
