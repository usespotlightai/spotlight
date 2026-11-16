import { InvalidJudgeDisagreementError } from '@insights/domain/exceptions/invalid-judge-disagreement.error';
import {
  isClaimPlace,
  noteOf,
} from '@insights/domain/value-objects/disagreement-note';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const CLAIM_ANSWERS = ['judge-right', 'claim-wrong'] as const;

export type ClaimAnswerKind = (typeof CLAIM_ANSWERS)[number];

export const claimAnswerKindOf = (raw: string): ClaimAnswerKind => {
  const known = CLAIM_ANSWERS.find((each) => each === raw);

  if (!known) {
    throw new InvalidJudgeDisagreementError(
      'must answer a claim with judge-right or claim-wrong',
    );
  }

  return known;
};

export class ClaimAnswer {
  private constructor(
    readonly claim: number,
    readonly answer: ClaimAnswerKind,
    readonly note: string | null,
    readonly by: UserId,
    readonly at: Date,
  ) {}

  static of(input: {
    claim: number;
    answer: ClaimAnswerKind;
    note: string | null;
    by: UserId;
    at: Date;
  }): ClaimAnswer {
    if (!isClaimPlace(input.claim)) {
      throw new InvalidJudgeDisagreementError(
        'must answer a claim by its place, from 0',
      );
    }

    return new ClaimAnswer(
      input.claim,
      claimAnswerKindOf(input.answer),
      noteOf(input.note),
      input.by,
      input.at,
    );
  }

  get claimWrong(): boolean {
    return this.answer === 'claim-wrong';
  }
}
