import type { AssistFailureReason } from '@assist/application/ports/assist-sessions.port';
import type {
  AssistRoundsPort,
  AssistSession,
  SessionRound,
} from '@change-review/application/ports/assist-rounds.port';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { DraftingRound } from '@change-review/domain/value-objects/drafting-round.vo';
import { GradingRound } from '@change-review/domain/value-objects/grading-round.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import {
  SessionFailure,
  type SessionFailureReason,
} from '@change-review/domain/value-objects/session-failure.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';

/** The purpose of the sessions that draft and redraft change stacks. */
export const DRAFTING_PURPOSE = 'change-review.change-stack';

/** The purpose of the sessions that grade answers to layer questions. */
export const GRADING_PURPOSE = 'change-review.grade';

const FAILURES: Record<AssistFailureReason, SessionFailureReason> = {
  'no-harness': 'no-harness',
  'base-run-elsewhere': 'base-run-elsewhere',
  'run-failed': 'run-failed',
  'no-result': 'no-result',
};

/** What a failed assist session means in change review's own words. */
export const sessionFailureOf = (reason: AssistFailureReason): SessionFailure =>
  SessionFailure.of(FAILURES[reason]);

/** `<stack>:draft:<attempt>`, or `<stack>:redraft:<check round>:<attempt>` for a redraft. */
export const draftingKeyOf = (round: DraftingRound): string =>
  round.redraftOf
    ? `${round.stackId.value}:redraft:${round.redraftOf.round}:${round.attempt}`
    : `${round.stackId.value}:draft:${round.attempt}`;

/** `<answer>:<answered at, in ms>:<attempt>`. */
export const gradingKeyOf = (round: GradingRound): string =>
  `${round.answerId.value}:${round.answeredAt.getTime()}:${round.attempt}`;

const DRAFTING_KEY = /^(.+):(?:draft|redraft:(first|recheck)):(\d+)$/;

const GRADING_KEY = /^(.+):(\d+):(\d+)$/;

const draftingRoundOf = (key: string): DraftingRound | null => {
  const [, stack, check, attempt] = DRAFTING_KEY.exec(key) ?? [];

  if (!stack || attempt === undefined) {
    return null;
  }

  const stackId = ChangeStackId.of(stack);

  return check
    ? DraftingRound.redraft(
        StackCheckId.of(stackId, check === 'recheck'),
        Number(attempt),
      )
    : DraftingRound.draft(stackId, Number(attempt));
};

const gradingRoundOf = (key: string): GradingRound | null => {
  const [, answer, at, attempt] = GRADING_KEY.exec(key) ?? [];

  return answer && at !== undefined && attempt !== undefined
    ? GradingRound.of({
        answerId: QuestionAnswerId.of(answer),
        answeredAt: new Date(Number(at)),
        attempt: Number(attempt),
      })
    : null;
};

/** Reads back the round of a session change review ordered, from the purpose and key its adapters gave it. */
export class AssistRounds implements AssistRoundsPort {
  roundOf(session: AssistSession): SessionRound | null {
    if (session.purpose === DRAFTING_PURPOSE) {
      const round = draftingRoundOf(session.key);
      return round ? { of: 'drafting', round } : null;
    }

    if (session.purpose === GRADING_PURPOSE) {
      const round = gradingRoundOf(session.key);
      return round ? { of: 'grading', round } : null;
    }

    return null;
  }
}
