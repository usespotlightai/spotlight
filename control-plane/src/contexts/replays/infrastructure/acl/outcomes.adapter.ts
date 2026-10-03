import type { ChangeJudgingPort } from '@outcomes/application/ports/change-judging.port';
import type { PairJudgingPort } from '@outcomes/application/ports/pair-judging.port';
import type {
  RunAcceptancePort,
  RunTurnout,
} from '@outcomes/application/ports/run-acceptance.port';
import type {
  JudgingAgainOrdered,
  JudgingOrder,
  JudgingOrdered,
  OutcomesPort,
  PairJudgingOrder,
} from '@replays/application/ports/outcomes.port';
import type { OriginalOutcome } from '@replays/domain/services/composition';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const outcomeOf = (turnout: RunTurnout): OriginalOutcome => {
  switch (turnout) {
    case 'accepted':
      return 'accepted';
    case 'sent-back':
      return 'sent-back';
    case 'asked':
      return 'asked';
    case 'failed':
      return 'failed';
    case 'other':
      return 'other';
  }
};

export class Outcomes implements OutcomesPort {
  constructor(
    private readonly acceptance: RunAcceptancePort,
    private readonly judging: ChangeJudgingPort,
    private readonly pairs: PairJudgingPort,
  ) {}

  acceptedAfter(run: RunId): Promise<boolean> {
    return this.acceptance.acceptedAfter(run.value);
  }

  async turnedOut(
    runs: readonly RunId[],
  ): Promise<ReadonlyMap<string, OriginalOutcome>> {
    const turnouts = await this.acceptance.turnouts(
      runs.map((each) => each.value),
    );

    return new Map(
      [...turnouts].map(([run, turnout]) => [run, outcomeOf(turnout)]),
    );
  }

  judge(order: JudgingOrder): Promise<JudgingOrdered> {
    return this.judging.ask({
      runId: order.run.value,
      workspaceId: order.workspaceId.value,
      teamId: order.teamId.value,
      rubric: order.judge.rubric,
      claims: order.judge.claims,
      passShare: order.judge.passShare,
      reference: order.reference?.value ?? null,
    });
  }

  judgeAgain(run: RunId): Promise<JudgingAgainOrdered> {
    return this.judging.askAgain(run.value);
  }

  judgePair(order: PairJudgingOrder): Promise<JudgingOrdered> {
    return this.pairs.ask({
      runId: order.run.value,
      against: order.against.value,
      workspaceId: order.workspaceId.value,
      teamId: order.teamId.value,
      rubric: order.judge.rubric,
      claims: order.judge.claims,
      passShare: order.judge.passShare,
      reference: order.reference.value,
      mostAttempts: order.mostAttempts,
    });
  }
}
