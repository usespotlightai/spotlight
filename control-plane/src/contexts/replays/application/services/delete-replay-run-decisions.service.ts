import { removeReplayRunDecision } from '@replays/application/services/replay-run-decision-removal';
import type { ReplayRunDecision } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import type { ReplayRunDecisionRepository } from '@replays/domain/repositories/replay-run-decision.repository';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteReplayRunDecisions {
  constructor(
    private readonly decisions: ReplayRunDecisionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async ofTeam(teamId: TeamId): Promise<void> {
    await this.deleteEach(await this.decisions.ofTeam(teamId));
  }

  async ofReplay(replayId: ReplayId): Promise<void> {
    await this.deleteEach(await this.decisions.ofReplay(replayId));
  }

  private async deleteEach(
    decisions: readonly ReplayRunDecision[],
  ): Promise<void> {
    for (const decision of decisions) {
      await this.transaction.inTransaction(() =>
        removeReplayRunDecision(this.decisions, decision),
      );
    }
  }
}
