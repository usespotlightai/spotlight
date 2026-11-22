import type {
  ChangeJudgmentsPort,
  ChangeJudgment as InsightsChangeJudgment,
} from '@insights/application/ports/change-judgments.port';
import type {
  ChangeJudgeOrder,
  ChangeJudgePort,
} from '@replays/application/ports/change-judge.port';
import {
  SESSION_WAITING,
  type SessionWaiting,
  type SettledSession,
} from '@replays/application/ports/session-outcomes';
import { ChangeJudgingRound } from '@replays/domain/value-objects/change-judging-round.vo';
import type { ChangeJudgment } from '@replays/domain/value-objects/change-judgment';
import { isJudgingAttempt } from '@replays/domain/value-objects/judging-attempt';

const judgmentOf = (judgment: InsightsChangeJudgment): ChangeJudgment =>
  judgment.judged
    ? {
        judged: true,
        claimResults: judgment.claimResults,
        reasons: judgment.reasons.map((each) => ({
          text: each.text,
          steps: [...each.steps],
          hunks: [...each.hunks],
          claim: each.claim,
        })),
        guidance: judgment.guidance,
        referenced: judgment.referenced,
        model: judgment.model,
      }
    : {
        judged: false,
        failure: judgment.failure,
      };

export class InsightsChangeJudge implements ChangeJudgePort {
  constructor(private readonly judgments: ChangeJudgmentsPort) {}

  async judge(
    order: ChangeJudgeOrder,
  ): Promise<ChangeJudgment | SessionWaiting> {
    const judgment = await this.judgments.judge({
      workspaceId: order.workspaceId,
      round: {
        runId: order.round.runId,
        judging: order.round.judging,
        attempt: order.round.attempt,
      },
      criteria: order.criteria,
      reference: order.reference,
      guidanceRequested: order.guidanceRequested,
      effectsBlocked: true,
    });

    return 'status' in judgment ? SESSION_WAITING : judgmentOf(judgment);
  }

  roundOf(session: SettledSession): ChangeJudgingRound | null {
    const round = this.judgments.roundOf(session);

    return round && isJudgingAttempt(round.judging)
      ? ChangeJudgingRound.of({
          runId: round.runId,
          judging: round.judging,
          attempt: round.attempt,
        })
      : null;
  }
}
