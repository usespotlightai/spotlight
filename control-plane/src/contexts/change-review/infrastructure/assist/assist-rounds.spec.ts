import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { DraftingRound } from '@change-review/domain/value-objects/drafting-round.vo';
import { GradingRound } from '@change-review/domain/value-objects/grading-round.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import {
  AssistRounds,
  DRAFTING_PURPOSE,
  draftingKeyOf,
  GRADING_PURPOSE,
  gradingKeyOf,
  sessionFailureOf,
} from '@change-review/infrastructure/assist/assist-rounds';
import { describe, expect, it } from 'vitest';

const STACK = ChangeStackId.of('stack-1');

const DRAFT = DraftingRound.draft(STACK, 2);
const REDRAFT = DraftingRound.redraft(StackCheckId.recheckOf(STACK), 1);
const GRADE = GradingRound.of({
  answerId: QuestionAnswerId.of('answer-1'),
  answeredAt: new Date(1_793_613_600_000),
  attempt: 3,
});

const rounds = new AssistRounds();

describe('the assist sessions of change review', () => {
  it('names one session for each round', () => {
    expect(draftingKeyOf(DRAFT)).toBe('stack-1:draft:2');
    expect(draftingKeyOf(REDRAFT)).toBe('stack-1:redraft:recheck:1');
    expect(gradingKeyOf(GRADE)).toBe('answer-1:1793613600000:3');
  });

  it('reads back the round of a session it ordered', () => {
    for (const round of [DRAFT, REDRAFT]) {
      const ran = rounds.roundOf({
        purpose: DRAFTING_PURPOSE,
        key: draftingKeyOf(round),
      });

      expect(ran?.of === 'drafting' && ran.round.equals(round)).toBe(true);
    }

    const graded = rounds.roundOf({
      purpose: GRADING_PURPOSE,
      key: gradingKeyOf(GRADE),
    });
    expect(graded?.of === 'grading' && graded.round.equals(GRADE)).toBe(true);
  });

  it('reads no round of a session another context ordered, or of a key it never gave', () => {
    expect(
      rounds.roundOf({ purpose: 'insights.judge', key: 'stack-1:draft:2' }),
    ).toBeNull();
    expect(
      rounds.roundOf({ purpose: DRAFTING_PURPOSE, key: 'stack-1' }),
    ).toBeNull();
    expect(
      rounds.roundOf({ purpose: GRADING_PURPOSE, key: 'answer-1:soon:1' }),
    ).toBeNull();
  });

  it('tells a failed session in change review’s words', () => {
    expect(sessionFailureOf('base-run-elsewhere')).toEqual(
      SessionFailure.of('base-run-elsewhere'),
    );
  });
});
