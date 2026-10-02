import type { ChangeJudgingPort } from '@outcomes/application/ports/change-judging.port';
import type { RunAcceptancePort } from '@outcomes/application/ports/run-acceptance.port';
import type {
  JudgingOrder,
  JudgingOrdered,
  OutcomesPort,
} from '@replays/application/ports/outcomes.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class Outcomes implements OutcomesPort {
  constructor(
    private readonly acceptance: RunAcceptancePort,
    private readonly judging: ChangeJudgingPort,
  ) {}

  acceptedAfter(run: RunId): Promise<boolean> {
    return this.acceptance.acceptedAfter(run.value);
  }

  judge(order: JudgingOrder): Promise<JudgingOrdered> {
    return this.judging.ask({
      runId: order.run.value,
      workspaceId: order.workspaceId.value,
      teamId: order.teamId.value,
      rubric: order.rubric,
      reference: order.reference?.value ?? null,
    });
  }
}
