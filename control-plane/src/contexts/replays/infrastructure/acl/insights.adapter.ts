import type { ChangeJudgingPort } from '@insights/application/ports/change-judging.port';
import type {
  RunAcceptancePort,
  RunDisposition,
} from '@insights/application/ports/run-acceptance.port';
import type { SideBySideJudgingPort } from '@insights/application/ports/side-by-side-judging.port';
import type {
  InsightsPort,
  JudgingAgainOrdered,
  JudgingOrder,
  JudgingOrdered,
  SideBySideJudgingOrder,
} from '@replays/application/ports/insights.port';
import type { OriginalOutcome } from '@replays/domain/services/composition';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const outcomeOf = (disposition: RunDisposition): OriginalOutcome => {
  switch (disposition) {
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

export class Insights implements InsightsPort {
  constructor(
    private readonly acceptance: RunAcceptancePort,
    private readonly judging: ChangeJudgingPort,
    private readonly pairs: SideBySideJudgingPort,
  ) {}

  acceptedAfter(run: RunId): Promise<boolean> {
    return this.acceptance.acceptedAfter(run.value);
  }

  async originalOutcomes(
    runs: readonly RunId[],
  ): Promise<ReadonlyMap<string, OriginalOutcome>> {
    const dispositions = await this.acceptance.dispositions(
      runs.map((each) => each.value),
    );

    return new Map(
      [...dispositions].map(([run, disposition]) => [
        run,
        outcomeOf(disposition),
      ]),
    );
  }

  judge(order: JudgingOrder): Promise<JudgingOrdered> {
    return this.judging.request({
      runId: order.run.value,
      workspaceId: order.workspaceId.value,
      teamId: order.teamId.value,
      rubric: order.judge.rubric,
      claims: order.judge.claims,
      passThreshold: order.judge.passThreshold,
      reference: order.reference?.value ?? null,
    });
  }

  judgeAgain(run: RunId): Promise<JudgingAgainOrdered> {
    return this.judging.requeue(run.value);
  }

  judgeSideBySide(order: SideBySideJudgingOrder): Promise<JudgingOrdered> {
    return this.pairs.request({
      runId: order.run.value,
      otherRunId: order.other.value,
      workspaceId: order.workspaceId.value,
      teamId: order.teamId.value,
      rubric: order.judge.rubric,
      claims: order.judge.claims,
      passThreshold: order.judge.passThreshold,
      reference: order.reference.value,
      maxAttempts: order.maxAttempts,
    });
  }
}
