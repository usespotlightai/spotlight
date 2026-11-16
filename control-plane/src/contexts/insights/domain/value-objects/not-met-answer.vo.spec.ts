import { InvalidJudgeDisagreementError } from '@insights/domain/exceptions/invalid-judge-disagreement.error';
import { NotMetAnswer } from '@insights/domain/value-objects/not-met-answer.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const notMet = (shouldHaveFailed: number | null, note: string | null) =>
  NotMetAnswer.of({
    shouldHaveFailed,
    note,
    by: UserId.of('user_ada'),
    at: new Date('2026-11-15T10:00:00.000Z'),
  });

describe('NotMetAnswer', () => {
  it('names the claim that should have failed, with an optional note', () => {
    const answer = notMet(2, null);

    expect(answer.shouldHaveFailed).toBe(2);
    expect(answer.pointsToNoClaim).toBe(false);
  });

  it('where no claim covers it, needs what was wrong', () => {
    expect(notMet(null, ' It broke the build. ').note).toBe(
      'It broke the build.',
    );
    expect(notMet(null, 'It broke the build.').pointsToNoClaim).toBe(true);
    expect(() => notMet(null, '   ')).toThrow(InvalidJudgeDisagreementError);
  });

  it('refuses a claim that is not a place from 0', () => {
    expect(() => notMet(-1, null)).toThrow(InvalidJudgeDisagreementError);
  });
});
