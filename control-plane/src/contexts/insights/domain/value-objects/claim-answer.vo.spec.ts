import { InvalidJudgeDisagreementError } from '@insights/domain/exceptions/invalid-judge-disagreement.error';
import { ClaimAnswer } from '@insights/domain/value-objects/claim-answer.vo';
import { MAX_DISAGREEMENT_NOTE_CHARS } from '@insights/domain/value-objects/disagreement-note';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-11-15T10:00:00.000Z');

const answerOf = (change: {
  claim?: number;
  answer?: string;
  note?: string | null;
}) =>
  ClaimAnswer.of({
    claim: change.claim ?? 1,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    answer: (change.answer ?? 'claim-wrong') as 'claim-wrong',
    note: change.note ?? null,
    by: UserId.of('user_ada'),
    at: AT,
  });

describe('ClaimAnswer', () => {
  it('keeps the claim, the answer and a trimmed note', () => {
    const answer = answerOf({ note: '  The test is in another file.  ' });

    expect(answer.claim).toBe(1);
    expect(answer.claimWrong).toBe(true);
    expect(answer.note).toBe('The test is in another file.');
    expect(answerOf({ note: '   ' }).note).toBeNull();
  });

  it('refuses a claim that is not a place from 0', () => {
    expect(() => answerOf({ claim: -1 })).toThrow(
      InvalidJudgeDisagreementError,
    );
    expect(() => answerOf({ claim: 1.5 })).toThrow(
      InvalidJudgeDisagreementError,
    );
  });

  it('refuses an answer other than judge-right or claim-wrong', () => {
    expect(() => answerOf({ answer: 'maybe' })).toThrow(
      InvalidJudgeDisagreementError,
    );
  });

  it('refuses a note longer than the limit', () => {
    expect(() =>
      answerOf({ note: 'x'.repeat(MAX_DISAGREEMENT_NOTE_CHARS + 1) }),
    ).toThrow(InvalidJudgeDisagreementError);
  });
});
