import { InvalidJudgeDisagreementError } from '@insights/domain/exceptions/invalid-judge-disagreement.error';
import {
  isClaimPlace,
  noteOf,
} from '@insights/domain/value-objects/disagreement-note';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class NotMetAnswer {
  private constructor(
    readonly shouldHaveFailed: number | null,
    readonly note: string | null,
    readonly by: UserId,
    readonly at: Date,
  ) {}

  static of(input: {
    shouldHaveFailed: number | null;
    note: string | null;
    by: UserId;
    at: Date;
  }): NotMetAnswer {
    const note = noteOf(input.note);

    if (
      input.shouldHaveFailed !== null &&
      !isClaimPlace(input.shouldHaveFailed)
    ) {
      throw new InvalidJudgeDisagreementError(
        'must name the claim that should have failed by its place, from 0',
      );
    }
    if (input.shouldHaveFailed === null && (note === null || note === '')) {
      throw new InvalidJudgeDisagreementError(
        'where the judge passed the run and no claim covers it, must say what was wrong',
      );
    }

    return new NotMetAnswer(input.shouldHaveFailed, note, input.by, input.at);
  }

  get pointsToNoClaim(): boolean {
    return this.shouldHaveFailed === null;
  }
}
